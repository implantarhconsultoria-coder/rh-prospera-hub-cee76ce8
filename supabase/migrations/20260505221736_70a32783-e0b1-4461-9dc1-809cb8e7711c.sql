-- Reativar mecânicos com user_id e access_token válidos que estão indevidamente revogados.
UPDATE public.tecnicos_campo
   SET link_status = 'ativo'
 WHERE user_id IS NOT NULL
   AND access_token IS NOT NULL
   AND link_status = 'revogado';