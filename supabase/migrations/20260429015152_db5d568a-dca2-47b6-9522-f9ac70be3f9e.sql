-- 1. Coluna de status do link com valores controlados
ALTER TABLE public.tecnicos_campo
  ADD COLUMN IF NOT EXISTS link_status text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS ultimo_acesso_em timestamptz,
  ADD COLUMN IF NOT EXISTS revogado_em timestamptz,
  ADD COLUMN IF NOT EXISTS revogado_por uuid;

-- 2. Restringe valores possíveis do status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tecnicos_campo_link_status_check'
  ) THEN
    ALTER TABLE public.tecnicos_campo
      ADD CONSTRAINT tecnicos_campo_link_status_check
      CHECK (link_status IN ('ativo','bloqueado','revogado'));
  END IF;
END $$;

-- 3. Sincroniza com flag legada link_bloqueado para qualquer registro existente
UPDATE public.tecnicos_campo
   SET link_status = 'bloqueado'
 WHERE link_bloqueado = true AND link_status <> 'bloqueado';

-- 4. Garante que todo técnico tenha access_token gerado
UPDATE public.tecnicos_campo
   SET access_token = public.gen_tecnico_access_token()
 WHERE access_token IS NULL OR access_token = '';

-- 5. Garante status ativo para os técnicos não bloqueados sem status definido
UPDATE public.tecnicos_campo
   SET link_status = 'ativo'
 WHERE link_status IS NULL OR link_status = '';

-- 6. Índice para acelerar a resolução do token
CREATE INDEX IF NOT EXISTS idx_tecnicos_campo_access_token
  ON public.tecnicos_campo (access_token);
