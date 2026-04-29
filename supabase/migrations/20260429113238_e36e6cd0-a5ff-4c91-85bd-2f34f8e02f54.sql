
-- 1) View como SECURITY INVOKER e restrita a admin
DROP VIEW IF EXISTS public.vw_funcionario_permissoes;

CREATE VIEW public.vw_funcionario_permissoes
WITH (security_invoker = true)
AS
SELECT
  f.id           AS funcionario_id,
  f.nome,
  f.cpf,
  f.cargo,
  f.status       AS status_funcionario,
  e.nome         AS empresa,
  fm.modulo,
  fm.status      AS status_modulo,
  fm.ultimo_acesso_em,
  fm.total_acessos,
  fm.autorizado_em,
  fm.autorizado_por_nome
FROM public.funcionarios f
LEFT JOIN public.empresas e          ON e.id = f.company_id
LEFT JOIN public.funcionario_modulos fm ON fm.funcionario_id = f.id;

REVOKE ALL ON public.vw_funcionario_permissoes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vw_funcionario_permissoes TO authenticated;
-- (RLS das tabelas base já protege; somente admin lê funcionarios/funcionario_modulos)

-- 2) Reforça revogação na função SECURITY DEFINER (uso só pela edge via service_role)
REVOKE EXECUTE ON FUNCTION public.validar_acesso_cpf(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validar_acesso_cpf(text,text) TO service_role;
