
-- =========================================================
-- VALES COMBUSTIVEL (QR vitalício)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.vales_combustivel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  acesso_externo_id uuid REFERENCES public.acessos_externos(id) ON DELETE SET NULL,
  funcionario_id uuid,
  mecanico_nome text NOT NULL,
  empresa text,
  filial text,
  placa text,
  posto_nome text,
  posto_cnpj text,
  posto_endereco text,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','bloqueado','cancelado')),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_vales_acesso ON public.vales_combustivel(acesso_externo_id);
CREATE INDEX IF NOT EXISTS idx_vales_codigo ON public.vales_combustivel(codigo);

ALTER TABLE public.vales_combustivel ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin gerencia vales" ON public.vales_combustivel;
CREATE POLICY "Admin gerencia vales" ON public.vales_combustivel
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS tg_vales_touch ON public.vales_combustivel;
CREATE TRIGGER tg_vales_touch BEFORE UPDATE ON public.vales_combustivel
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- ABASTECIMENTOS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.abastecimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vale_id uuid REFERENCES public.vales_combustivel(id) ON DELETE SET NULL,
  vale_codigo text,
  qr_codigo text,
  acesso_externo_id uuid REFERENCES public.acessos_externos(id) ON DELETE SET NULL,
  funcionario_id uuid,
  mecanico_nome text NOT NULL,
  empresa text,
  filial text,
  placa text,
  data date NOT NULL DEFAULT CURRENT_DATE,
  hora time NOT NULL DEFAULT CURRENT_TIME,
  competencia text,
  combustivel text,
  valor numeric(12,2) NOT NULL DEFAULT 0,
  litros numeric(12,3) NOT NULL DEFAULT 0,
  valor_por_litro numeric(12,3),
  km_atual numeric(12,1),
  posto_nome text,
  posto_cnpj text,
  posto_endereco text,
  foto_bomba_url text,
  foto_painel_url text,
  latitude double precision,
  longitude double precision,
  endereco text,
  observacao text,
  status text NOT NULL DEFAULT 'concluido' CHECK (status IN ('concluido','pendente','cancelado','enviado')),
  preenchimento text DEFAULT 'app_mecanico',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_abast_acesso ON public.abastecimentos(acesso_externo_id);
CREATE INDEX IF NOT EXISTS idx_abast_competencia ON public.abastecimentos(competencia);
CREATE INDEX IF NOT EXISTS idx_abast_data ON public.abastecimentos(data);

ALTER TABLE public.abastecimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin gerencia abastecimentos" ON public.abastecimentos;
CREATE POLICY "Admin gerencia abastecimentos" ON public.abastecimentos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.tg_abast_normalize()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.competencia IS NULL OR NEW.competencia = '' THEN
    NEW.competencia := to_char(COALESCE(NEW.data, CURRENT_DATE), 'YYYY-MM');
  END IF;
  IF NEW.litros IS NOT NULL AND NEW.litros > 0 THEN
    NEW.valor_por_litro := ROUND((NEW.valor / NEW.litros)::numeric, 3);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_abast_norm ON public.abastecimentos;
CREATE TRIGGER tg_abast_norm BEFORE INSERT OR UPDATE ON public.abastecimentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_abast_normalize();

-- =========================================================
-- VIEW MENSAL
-- =========================================================
CREATE OR REPLACE VIEW public.vw_abastecimentos_mensal AS
SELECT
  competencia,
  acesso_externo_id,
  mecanico_nome,
  empresa,
  filial,
  placa,
  COUNT(*)::int AS qtd_abastecimentos,
  COALESCE(SUM(litros),0)::numeric(14,3) AS total_litros,
  COALESCE(SUM(valor),0)::numeric(14,2) AS total_valor,
  CASE WHEN SUM(litros)>0 THEN ROUND((SUM(valor)/SUM(litros))::numeric,3) ELSE 0 END AS media_valor_litro,
  MIN(km_atual) AS km_min,
  MAX(km_atual) AS km_max
FROM public.abastecimentos
WHERE status <> 'cancelado'
GROUP BY competencia, acesso_externo_id, mecanico_nome, empresa, filial, placa;

-- =========================================================
-- STORAGE — abastecimento-fotos
-- =========================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='abastecimento-fotos') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('abastecimento-fotos','abastecimento-fotos', true);
  ELSE
    UPDATE storage.buckets SET public=true WHERE id='abastecimento-fotos';
  END IF;
END $$;

DROP POLICY IF EXISTS "Public read abastecimento-fotos" ON storage.objects;
CREATE POLICY "Public read abastecimento-fotos" ON storage.objects
  FOR SELECT USING (bucket_id='abastecimento-fotos');

DROP POLICY IF EXISTS "Anyone upload abastecimento-fotos" ON storage.objects;
CREATE POLICY "Anyone upload abastecimento-fotos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id='abastecimento-fotos');

-- =========================================================
-- RPCs — APP MECÂNICO
-- =========================================================
CREATE OR REPLACE FUNCTION public.app_mecanico_validar_qr(p_acesso_id uuid, p_codigo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v public.acessos_externos;
  vc public.vales_combustivel;
  v_codigo text;
BEGIN
  BEGIN v := public._app_mecanico_get_acesso(p_acesso_id);
  EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('ok',false,'error','acesso_nao_autorizado'); END;

  v_codigo := upper(trim(coalesce(p_codigo,'')));
  SELECT * INTO vc FROM public.vales_combustivel
   WHERE deleted_at IS NULL
     AND (codigo = p_codigo OR upper(trim(codigo)) = v_codigo)
   LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','qr_nao_encontrado'); END IF;
  IF vc.status <> 'ativo' THEN RETURN jsonb_build_object('ok',false,'error','qr_bloqueado'); END IF;
  IF vc.acesso_externo_id IS NOT NULL AND vc.acesso_externo_id <> v.id THEN
    RETURN jsonb_build_object('ok',false,'error','qr_de_outro_mecanico');
  END IF;

  RETURN jsonb_build_object('ok',true,'vale', jsonb_build_object(
    'id', vc.id, 'codigo', vc.codigo, 'placa', COALESCE(vc.placa,''),
    'posto_nome', COALESCE(vc.posto_nome,''),
    'mecanico_nome', vc.mecanico_nome,
    'empresa', COALESCE(vc.empresa,''), 'filial', COALESCE(vc.filial,'')
  ));
END $$;

CREATE OR REPLACE FUNCTION public.app_mecanico_registrar_abastecimento_qr(
  p_acesso_id uuid, p_qr_codigo text,
  p_valor numeric, p_litros numeric, p_combustivel text, p_km numeric,
  p_placa text DEFAULT NULL, p_posto_nome text DEFAULT NULL,
  p_observacao text DEFAULT NULL,
  p_foto_bomba_url text DEFAULT NULL, p_foto_painel_url text DEFAULT NULL,
  p_latitude double precision DEFAULT NULL, p_longitude double precision DEFAULT NULL,
  p_endereco text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v public.acessos_externos;
  vc public.vales_combustivel;
  v_id uuid;
  v_codigo text;
BEGIN
  BEGIN v := public._app_mecanico_get_acesso(p_acesso_id);
  EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('ok',false,'error','acesso_nao_autorizado'); END;

  IF COALESCE(p_foto_bomba_url,'')='' THEN RETURN jsonb_build_object('ok',false,'error','foto_bomba_obrigatoria'); END IF;
  IF COALESCE(p_foto_painel_url,'')='' THEN RETURN jsonb_build_object('ok',false,'error','foto_painel_obrigatoria'); END IF;

  v_codigo := upper(trim(coalesce(p_qr_codigo,'')));
  SELECT * INTO vc FROM public.vales_combustivel
   WHERE deleted_at IS NULL
     AND (codigo = p_qr_codigo OR upper(trim(codigo)) = v_codigo)
   LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','qr_nao_encontrado'); END IF;
  IF vc.status <> 'ativo' THEN RETURN jsonb_build_object('ok',false,'error','qr_bloqueado'); END IF;
  IF vc.acesso_externo_id IS NOT NULL AND vc.acesso_externo_id <> v.id THEN
    RETURN jsonb_build_object('ok',false,'error','qr_de_outro_mecanico');
  END IF;

  INSERT INTO public.abastecimentos(
    vale_id, vale_codigo, qr_codigo, acesso_externo_id, funcionario_id,
    mecanico_nome, empresa, filial, placa,
    valor, litros, combustivel, km_atual,
    posto_nome, posto_cnpj, posto_endereco,
    foto_bomba_url, foto_painel_url,
    latitude, longitude, endereco,
    observacao, status, preenchimento
  ) VALUES (
    vc.id, vc.codigo, vc.codigo, v.id, v.funcionario_id,
    v.nome, COALESCE(v.empresa,''), COALESCE(v.filial,''),
    COALESCE(NULLIF(p_placa,''), vc.placa),
    COALESCE(p_valor,0), COALESCE(p_litros,0), COALESCE(p_combustivel,'Diesel S10'), p_km,
    COALESCE(NULLIF(p_posto_nome,''), vc.posto_nome), vc.posto_cnpj, vc.posto_endereco,
    p_foto_bomba_url, p_foto_painel_url,
    p_latitude, p_longitude, p_endereco,
    COALESCE(p_observacao,''), 'concluido', 'app_mecanico'
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok',true,'id',v_id);
END $$;

CREATE OR REPLACE FUNCTION public.app_mecanico_listar_abastecimentos(p_acesso_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v public.acessos_externos;
  v_arr jsonb;
BEGIN
  BEGIN v := public._app_mecanico_get_acesso(p_acesso_id);
  EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('ok',false,'error','acesso_nao_autorizado'); END;

  SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.data DESC, a.hora DESC), '[]'::jsonb)
    INTO v_arr FROM public.abastecimentos a
   WHERE a.acesso_externo_id = v.id;

  RETURN jsonb_build_object('ok',true,'abastecimentos', v_arr);
END $$;

-- =========================================================
-- RPCs — ADMIN
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_combustivel_qr_gerar(p_acesso_id uuid, p_placa text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v public.acessos_externos;
  vc public.vales_combustivel;
  v_codigo text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RETURN jsonb_build_object('ok',false,'error','sem_permissao');
  END IF;
  SELECT * INTO v FROM public.acessos_externos WHERE id=p_acesso_id AND modulo='mecanico';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','mecanico_nao_encontrado'); END IF;

  -- 1 QR vitalício por mecânico (reutiliza existente)
  SELECT * INTO vc FROM public.vales_combustivel
   WHERE acesso_externo_id=p_acesso_id AND deleted_at IS NULL LIMIT 1;
  IF FOUND THEN
    IF p_placa IS NOT NULL THEN
      UPDATE public.vales_combustivel SET placa=p_placa WHERE id=vc.id RETURNING * INTO vc;
    END IF;
    RETURN jsonb_build_object('ok',true,'vale', to_jsonb(vc), 'novo', false);
  END IF;

  v_codigo := 'COMB-' || upper(substring(replace(gen_random_uuid()::text,'-',''),1,10));
  INSERT INTO public.vales_combustivel(codigo, acesso_externo_id, funcionario_id, mecanico_nome, empresa, filial, placa, created_by)
  VALUES (v_codigo, v.id, v.funcionario_id, v.nome, v.empresa, v.filial, p_placa, auth.uid())
  RETURNING * INTO vc;

  RETURN jsonb_build_object('ok',true,'vale', to_jsonb(vc), 'novo', true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_combustivel_qr_toggle(p_vale_id uuid, p_bloquear boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RETURN jsonb_build_object('ok',false,'error','sem_permissao');
  END IF;
  UPDATE public.vales_combustivel
     SET status = CASE WHEN p_bloquear THEN 'bloqueado' ELSE 'ativo' END
   WHERE id = p_vale_id;
  RETURN jsonb_build_object('ok',true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_combustivel_relatorio_mensal(
  p_competencia text,
  p_empresa text DEFAULT NULL,
  p_filial text DEFAULT NULL,
  p_acesso_id uuid DEFAULT NULL,
  p_placa text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_arr jsonb; v_tot jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RETURN jsonb_build_object('ok',false,'error','sem_permissao');
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.mecanico_nome), '[]'::jsonb)
    INTO v_arr
    FROM public.vw_abastecimentos_mensal t
   WHERE t.competencia = p_competencia
     AND (p_empresa IS NULL OR t.empresa = p_empresa)
     AND (p_filial IS NULL OR t.filial = p_filial)
     AND (p_acesso_id IS NULL OR t.acesso_externo_id = p_acesso_id)
     AND (p_placa IS NULL OR t.placa = p_placa);

  SELECT jsonb_build_object(
    'qtd', COALESCE(SUM(qtd_abastecimentos),0),
    'litros', COALESCE(SUM(total_litros),0),
    'valor', COALESCE(SUM(total_valor),0)
  ) INTO v_tot FROM public.vw_abastecimentos_mensal
   WHERE competencia=p_competencia
     AND (p_empresa IS NULL OR empresa = p_empresa)
     AND (p_filial IS NULL OR filial = p_filial)
     AND (p_acesso_id IS NULL OR acesso_externo_id = p_acesso_id)
     AND (p_placa IS NULL OR placa = p_placa);

  RETURN jsonb_build_object('ok',true,'linhas', v_arr, 'totais', v_tot);
END $$;
