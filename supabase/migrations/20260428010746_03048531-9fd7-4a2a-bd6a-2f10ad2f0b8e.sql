-- 1) Adicionar novos valores ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'faturamento';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'financeiro';

-- 2) Tabela de configuração de bloqueio por horário (desligado por padrão)
CREATE TABLE IF NOT EXISTS public.config_acesso_horario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT false,
  hora_inicio time NOT NULL DEFAULT '07:00',
  hora_fim time NOT NULL DEFAULT '19:00',
  dias_semana text NOT NULL DEFAULT 'seg,ter,qua,qui,sex',
  observacao text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.config_acesso_horario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manage config_acesso_horario" ON public.config_acesso_horario;
CREATE POLICY "Admin manage config_acesso_horario" ON public.config_acesso_horario
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "All view config_acesso_horario" ON public.config_acesso_horario;
CREATE POLICY "All view config_acesso_horario" ON public.config_acesso_horario
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.config_acesso_horario (enabled) 
SELECT false WHERE NOT EXISTS (SELECT 1 FROM public.config_acesso_horario);

-- 3) Permitir admin editar/excluir prestadores de qualquer empresa
DROP POLICY IF EXISTS "Admin manage prestadores" ON public.prestadores;
CREATE POLICY "Admin manage prestadores" ON public.prestadores
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));