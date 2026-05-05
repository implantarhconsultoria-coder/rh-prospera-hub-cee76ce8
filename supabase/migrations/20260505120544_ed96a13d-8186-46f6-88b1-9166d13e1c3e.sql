
-- ============================================================
-- Sistema simples de acesso por CPF (links fixos /sp /pg /go)
-- ============================================================

-- 1) Tabela de permissões por funcionário/módulo
CREATE TABLE IF NOT EXISTS public.permissoes_acesso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  modulo TEXT NOT NULL CHECK (modulo IN ('financeiro','faturamento','mecanicos')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (funcionario_id, modulo)
);

ALTER TABLE public.permissoes_acesso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin gerencia permissoes" ON public.permissoes_acesso;
CREATE POLICY "admin gerencia permissoes"
ON public.permissoes_acesso
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_permissoes_acesso_func ON public.permissoes_acesso(funcionario_id);

DROP TRIGGER IF EXISTS trg_permissoes_acesso_updated ON public.permissoes_acesso;
CREATE TRIGGER trg_permissoes_acesso_updated
BEFORE UPDATE ON public.permissoes_acesso
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Tabela de log de acessos
CREATE TABLE IF NOT EXISTS public.acesso_cpf_simples_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf TEXT NOT NULL,
  unidade TEXT NOT NULL,
  modulo TEXT,
  funcionario_id UUID,
  resultado TEXT NOT NULL, -- ok | negado
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.acesso_cpf_simples_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin le log acesso" ON public.acesso_cpf_simples_log;
CREATE POLICY "admin le log acesso"
ON public.acesso_cpf_simples_log
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_acesso_log_cpf ON public.acesso_cpf_simples_log(cpf);
CREATE INDEX IF NOT EXISTS idx_acesso_log_data ON public.acesso_cpf_simples_log(created_at DESC);

-- 3) Função RPC: validar CPF + unidade e retornar módulos liberados
CREATE OR REPLACE FUNCTION public.acesso_cpf_simples(p_unidade TEXT, p_cpf TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cpf TEXT;
  v_unidade TEXT;
  v_func RECORD;
  v_empresa_nome TEXT;
  v_empresas_ok TEXT[];
  v_modulos JSONB;
  v_status TEXT;
BEGIN
  v_cpf := regexp_replace(COALESCE(p_cpf,''), '[^0-9]', '', 'g');
  v_unidade := lower(trim(COALESCE(p_unidade,'')));

  IF length(v_cpf) <> 11 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cpf_invalido');
  END IF;

  -- Quais empresas o link aceita
  v_empresas_ok := CASE v_unidade
    WHEN 'sp' THEN ARRAY['ALQUI OBRAS','TOPAC MATRIZ','LMT']
    WHEN 'pg' THEN ARRAY['TOPAC FILIAL PRAIA GRANDE']
    WHEN 'go' THEN ARRAY['TOPAC FILIAL GOIÂNIA']
    ELSE NULL
  END;

  IF v_empresas_ok IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'link_invalido');
  END IF;

  -- Busca funcionário
  SELECT f.*, e.nome AS empresa_nome
    INTO v_func
  FROM public.funcionarios f
  LEFT JOIN public.empresas e ON e.id = f.company_id
  WHERE regexp_replace(COALESCE(f.cpf,''), '[^0-9]', '', 'g') = v_cpf
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.acesso_cpf_simples_log(cpf, unidade, resultado, motivo)
    VALUES (v_cpf, v_unidade, 'negado', 'cpf_nao_localizado');
    RETURN jsonb_build_object('ok', false, 'error', 'cpf_nao_localizado');
  END IF;

  v_empresa_nome := COALESCE(v_func.empresa_nome,'');
  v_status := lower(trim(COALESCE(v_func.status,'ativo')));

  -- Ativo?
  IF v_status NOT IN ('ativo','active') THEN
    INSERT INTO public.acesso_cpf_simples_log(cpf, unidade, resultado, motivo, funcionario_id)
    VALUES (v_cpf, v_unidade, 'negado', 'acesso_nao_autorizado', v_func.id);
    RETURN jsonb_build_object('ok', false, 'error', 'acesso_nao_autorizado');
  END IF;

  -- Pertence à unidade?
  IF NOT (v_empresa_nome = ANY (v_empresas_ok)) THEN
    INSERT INTO public.acesso_cpf_simples_log(cpf, unidade, resultado, motivo, funcionario_id)
    VALUES (v_cpf, v_unidade, 'negado', 'unidade_incorreta', v_func.id);
    RETURN jsonb_build_object('ok', false, 'error', 'unidade_incorreta');
  END IF;

  -- Módulos liberados
  SELECT COALESCE(jsonb_agg(modulo ORDER BY modulo), '[]'::jsonb)
    INTO v_modulos
  FROM public.permissoes_acesso
  WHERE funcionario_id = v_func.id AND ativo = true;

  IF v_modulos = '[]'::jsonb THEN
    INSERT INTO public.acesso_cpf_simples_log(cpf, unidade, resultado, motivo, funcionario_id)
    VALUES (v_cpf, v_unidade, 'negado', 'sem_permissao', v_func.id);
    RETURN jsonb_build_object('ok', false, 'error', 'sem_permissao');
  END IF;

  INSERT INTO public.acesso_cpf_simples_log(cpf, unidade, resultado, motivo, funcionario_id)
  VALUES (v_cpf, v_unidade, 'ok', 'autorizado', v_func.id);

  RETURN jsonb_build_object(
    'ok', true,
    'unidade', v_unidade,
    'modulos', v_modulos,
    'usuario', jsonb_build_object(
      'id', v_func.id,
      'nome', v_func.nome,
      'cargo', COALESCE(v_func.cargo,''),
      'empresa', v_empresa_nome,
      'cpf', v_cpf
    )
  );
END;
$$;

-- Permitir chamada anônima (link público)
GRANT EXECUTE ON FUNCTION public.acesso_cpf_simples(TEXT, TEXT) TO anon, authenticated;
