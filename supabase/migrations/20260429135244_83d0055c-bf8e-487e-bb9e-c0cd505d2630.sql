-- Campos de pagamento e envio em ferias_avisos
ALTER TABLE public.ferias_avisos
  ADD COLUMN IF NOT EXISTS prazo_pagamento date,
  ADD COLUMN IF NOT EXISTS status_pagamento text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS data_pagamento date,
  ADD COLUMN IF NOT EXISTS valor_pago numeric(12,2),
  ADD COLUMN IF NOT EXISTS enviado_contabilidade_em timestamptz,
  ADD COLUMN IF NOT EXISTS enviado_contabilidade_por text,
  ADD COLUMN IF NOT EXISTS enviado_contabilidade_destinos text;

-- Trigger: ao inserir, calcular prazo_pagamento = inicio - 2 dias (CLT art.145)
CREATE OR REPLACE FUNCTION public.set_ferias_prazo_pagamento()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.prazo_pagamento IS NULL AND NEW.periodo_gozo_inicio IS NOT NULL THEN
    NEW.prazo_pagamento := (NEW.periodo_gozo_inicio - INTERVAL '2 days')::date;
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_ferias_prazo ON public.ferias_avisos;
CREATE TRIGGER trg_ferias_prazo
  BEFORE INSERT OR UPDATE ON public.ferias_avisos
  FOR EACH ROW EXECUTE FUNCTION public.set_ferias_prazo_pagamento();

-- Tabela de configuração de e-mails da contabilidade
CREATE TABLE IF NOT EXISTS public.config_emails_contabilidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_robson text NOT NULL DEFAULT '',
  email_marisa text NOT NULL DEFAULT '',
  emails_copia text NOT NULL DEFAULT '',
  updated_by uuid,
  updated_by_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Garantir uma única linha (singleton)
INSERT INTO public.config_emails_contabilidade (email_robson, email_marisa, emails_copia)
SELECT 'robson@topac.com.br', 'marisa@aatconsultoria.com.br', 'adm.matriz@topac.com.br'
WHERE NOT EXISTS (SELECT 1 FROM public.config_emails_contabilidade);

ALTER TABLE public.config_emails_contabilidade ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manage config emails" ON public.config_emails_contabilidade;
CREATE POLICY "Admin manage config emails"
  ON public.config_emails_contabilidade
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated read config emails" ON public.config_emails_contabilidade;
CREATE POLICY "Authenticated read config emails"
  ON public.config_emails_contabilidade
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS trg_cfg_emails_updated ON public.config_emails_contabilidade;
CREATE TRIGGER trg_cfg_emails_updated
  BEFORE UPDATE ON public.config_emails_contabilidade
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();