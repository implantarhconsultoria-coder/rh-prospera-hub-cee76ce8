
-- ============================================================
-- 1) RLS / STORAGE p/ upload público de fotos do QR combustível
-- ============================================================

-- Permitir uploads anônimos no bucket abastecimento-fotos no prefixo qr/
DROP POLICY IF EXISTS "Public QR upload abastecimento fotos" ON storage.objects;
CREATE POLICY "Public QR upload abastecimento fotos"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'abastecimento-fotos'
  AND (storage.foldername(name))[1] = 'qr'
);

-- Permitir leitura via signed URL (signed URLs já bypassa RLS, mas para evitar erros em createSignedUrl com role anon)
DROP POLICY IF EXISTS "Public QR read abastecimento fotos" ON storage.objects;
CREATE POLICY "Public QR read abastecimento fotos"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'abastecimento-fotos'
  AND (storage.foldername(name))[1] = 'qr'
);

-- ============================================================
-- 2) RLS abastecimentos: garantir que admin/operacional possam
--    inserir manualmente também via UI (já existe ALL via has_role).
--    Aqui adicionamos política de INSERT específica para
--    autenticados que sejam o "self" (tecnico).
-- ============================================================
DROP POLICY IF EXISTS "Self insert own abastecimentos" ON public.abastecimentos;
CREATE POLICY "Self insert own abastecimentos"
ON public.abastecimentos FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ============================================================
-- 3) Histórico de alterações em lançamentos mensais
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lancamentos_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lancamento_id UUID,
  funcionario_id UUID,
  company_id UUID,
  competencia TEXT,
  campo TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo TEXT,
  user_id UUID,
  usuario_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lancamentos_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin ve historico lancamentos" ON public.lancamentos_historico;
CREATE POLICY "Admin ve historico lancamentos"
ON public.lancamentos_historico FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Filial ve historico lancamentos da empresa" ON public.lancamentos_historico;
CREATE POLICY "Filial ve historico lancamentos da empresa"
ON public.lancamentos_historico FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.empresas e
          WHERE e.id = lancamentos_historico.company_id
            AND e.nome = ANY (public.get_user_empresas()))
);

DROP POLICY IF EXISTS "Autenticado registra historico lancamentos" ON public.lancamentos_historico;
CREATE POLICY "Autenticado registra historico lancamentos"
ON public.lancamentos_historico FOR INSERT TO authenticated
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_lanc_hist_lanc ON public.lancamentos_historico(lancamento_id);
CREATE INDEX IF NOT EXISTS idx_lanc_hist_comp ON public.lancamentos_historico(company_id, competencia);

-- ============================================================
-- 4) Trigger: ao alterar lancamentos_mensais
--    a) registra histórico de campos numéricos alterados
--    b) marca fechamento daquela (empresa,competencia) como
--       "em_andamento" (se existir) e recalcula totais
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_lancamentos_after_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_nome TEXT;
BEGIN
  -- nome do usuário (best-effort)
  SELECT COALESCE(nome_completo, email) INTO v_nome
  FROM public.profiles WHERE user_id = v_uid LIMIT 1;

  IF TG_OP = 'UPDATE' THEN
    -- Loga alterações por campo (apenas os campos editáveis principais)
    IF NEW.faltas_dias IS DISTINCT FROM OLD.faltas_dias THEN
      INSERT INTO public.lancamentos_historico(lancamento_id,funcionario_id,company_id,competencia,campo,valor_anterior,valor_novo,user_id,usuario_nome)
      VALUES (NEW.id,NEW.funcionario_id,NEW.company_id,NEW.competencia,'faltas_dias',OLD.faltas_dias::text,NEW.faltas_dias::text,v_uid,v_nome);
    END IF;
    IF NEW.atrasos IS DISTINCT FROM OLD.atrasos THEN
      INSERT INTO public.lancamentos_historico(lancamento_id,funcionario_id,company_id,competencia,campo,valor_anterior,valor_novo,user_id,usuario_nome)
      VALUES (NEW.id,NEW.funcionario_id,NEW.company_id,NEW.competencia,'atrasos',OLD.atrasos::text,NEW.atrasos::text,v_uid,v_nome);
    END IF;
    IF NEW.he50 IS DISTINCT FROM OLD.he50 THEN
      INSERT INTO public.lancamentos_historico(lancamento_id,funcionario_id,company_id,competencia,campo,valor_anterior,valor_novo,user_id,usuario_nome)
      VALUES (NEW.id,NEW.funcionario_id,NEW.company_id,NEW.competencia,'he50',OLD.he50::text,NEW.he50::text,v_uid,v_nome);
    END IF;
    IF NEW.he100 IS DISTINCT FROM OLD.he100 THEN
      INSERT INTO public.lancamentos_historico(lancamento_id,funcionario_id,company_id,competencia,campo,valor_anterior,valor_novo,user_id,usuario_nome)
      VALUES (NEW.id,NEW.funcionario_id,NEW.company_id,NEW.competencia,'he100',OLD.he100::text,NEW.he100::text,v_uid,v_nome);
    END IF;
    IF NEW.adicionais IS DISTINCT FROM OLD.adicionais THEN
      INSERT INTO public.lancamentos_historico(lancamento_id,funcionario_id,company_id,competencia,campo,valor_anterior,valor_novo,user_id,usuario_nome)
      VALUES (NEW.id,NEW.funcionario_id,NEW.company_id,NEW.competencia,'adicionais',OLD.adicionais::text,NEW.adicionais::text,v_uid,v_nome);
    END IF;
    IF NEW.descontos_diversos IS DISTINCT FROM OLD.descontos_diversos THEN
      INSERT INTO public.lancamentos_historico(lancamento_id,funcionario_id,company_id,competencia,campo,valor_anterior,valor_novo,user_id,usuario_nome)
      VALUES (NEW.id,NEW.funcionario_id,NEW.company_id,NEW.competencia,'descontos_diversos',OLD.descontos_diversos::text,NEW.descontos_diversos::text,v_uid,v_nome);
    END IF;
    IF NEW.adiantamento IS DISTINCT FROM OLD.adiantamento THEN
      INSERT INTO public.lancamentos_historico(lancamento_id,funcionario_id,company_id,competencia,campo,valor_anterior,valor_novo,user_id,usuario_nome)
      VALUES (NEW.id,NEW.funcionario_id,NEW.company_id,NEW.competencia,'adiantamento',OLD.adiantamento::text,NEW.adiantamento::text,v_uid,v_nome);
    END IF;
  END IF;

  -- Recalcula fechamento da filial p/ esta competência (se não estiver fechado)
  PERFORM public.fechamento_filial_sincronizar(NEW.company_id, NEW.competencia);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lanc_after_change ON public.lancamentos_mensais;
CREATE TRIGGER trg_lanc_after_change
AFTER INSERT OR UPDATE ON public.lancamentos_mensais
FOR EACH ROW EXECUTE FUNCTION public.tg_lancamentos_after_change();
