-- Deduplicate (cpf_clean, modulo) keeping the most recent record
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY cpf_clean, modulo
    ORDER BY (status='ativo')::int DESC, created_at DESC NULLS LAST, id DESC
  ) AS rn
  FROM public.acessos_externos
  WHERE cpf_clean IS NOT NULL
)
DELETE FROM public.acessos_externos a
USING ranked r
WHERE a.id = r.id AND r.rn > 1;

-- Add unique constraint to support ON CONFLICT (cpf_clean, modulo)
ALTER TABLE public.acessos_externos
  ADD CONSTRAINT acessos_externos_cpf_modulo_unique UNIQUE (cpf_clean, modulo);