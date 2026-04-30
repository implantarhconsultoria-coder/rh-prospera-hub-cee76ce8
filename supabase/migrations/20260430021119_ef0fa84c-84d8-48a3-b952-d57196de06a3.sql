ALTER TABLE public.funcionario_modulos
  DROP CONSTRAINT IF EXISTS funcionario_modulos_modulo_check;

ALTER TABLE public.funcionario_modulos
  ADD CONSTRAINT funcionario_modulos_modulo_check
  CHECK (modulo IN (
    'operacional','financeiro','faturamento','rh','almoxarifado','mecanicos','filial',
    'compras','chamados','abastecimento','ponto','km','documentos','fechamento'
  ));

CREATE OR REPLACE FUNCTION public.validar_acesso_cpf_slug(p_slug text, p_cpf text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link RECORD;
  v_func RECORD;
  v_perm RECORD;
  v_empresa_nome TEXT;
  v_cpf_clean TEXT;
  v_acesso_status TEXT;
BEGIN
  v_cpf_clean := regexp_replace(COALESCE(p_cpf,''), '[^0-9]', '', 'g');

  IF length(v_cpf_clean) <> 11 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cpf_invalido');
  END IF;

  SELECT * INTO v_link
  FROM public.links_acesso_publico
  WHERE lower(slug) = lower(COALESCE(p_slug, ''))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'link_invalido');
  END IF;

  IF v_link.status <> 'ativo' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'link_bloqueado');
  END IF;

  SELECT f.*, e.nome AS empresa_nome
    INTO v_func
  FROM public.funcionarios f
  LEFT JOIN public.empresas e ON e.id = f.company_id
  WHERE regexp_replace(COALESCE(f.cpf,''), '[^0-9]', '', 'g') = v_cpf_clean
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.acesso_cpf_logs(cpf, modulo, unidade, resultado, motivo)
    VALUES (v_cpf_clean, v_link.modulo, v_link.unidade, 'negado', 'cpf_nao_encontrado_funcionarios');

    RETURN jsonb_build_object('ok', false, 'error', 'cpf_nao_encontrado_funcionarios');
  END IF;

  v_empresa_nome := COALESCE(v_func.empresa_nome, '');
  v_acesso_status := lower(COALESCE(v_func.acesso_status, v_func.status, 'ativo'));

  IF v_acesso_status IN ('desligado') THEN
    INSERT INTO public.acesso_cpf_logs(cpf, modulo, unidade, resultado, motivo, funcionario_id)
    VALUES (v_cpf_clean, v_link.modulo, v_link.unidade, 'negado', 'funcionario_desligado', v_func.id);
    RETURN jsonb_build_object('ok', false, 'error', 'funcionario_desligado');
  ELSIF v_acesso_status IN ('ferias', 'férias') THEN
    INSERT INTO public.acesso_cpf_logs(cpf, modulo, unidade, resultado, motivo, funcionario_id)
    VALUES (v_cpf_clean, v_link.modulo, v_link.unidade, 'negado', 'funcionario_ferias', v_func.id);
    RETURN jsonb_build_object('ok', false, 'error', 'funcionario_ferias');
  ELSIF v_acesso_status IN ('bloqueado', 'inativo') THEN
    INSERT INTO public.acesso_cpf_logs(cpf, modulo, unidade, resultado, motivo, funcionario_id)
    VALUES (v_cpf_clean, v_link.modulo, v_link.unidade, 'negado', 'funcionario_bloqueado', v_func.id);
    RETURN jsonb_build_object('ok', false, 'error', 'funcionario_bloqueado');
  END IF;

  IF array_length(v_link.empresas_permitidas, 1) IS NOT NULL
     AND v_empresa_nome <> ''
     AND NOT (v_empresa_nome = ANY (v_link.empresas_permitidas)) THEN
    INSERT INTO public.acesso_cpf_logs(cpf, modulo, unidade, resultado, motivo, funcionario_id)
    VALUES (v_cpf_clean, v_link.modulo, v_link.unidade, 'negado', 'unidade_incorreta', v_func.id);
    RETURN jsonb_build_object('ok', false, 'error', 'unidade_incorreta');
  END IF;

  IF v_link.modulo = 'operacional' THEN
    SELECT access_token, link_status, link_bloqueado
      INTO v_perm
    FROM public.tecnicos_campo
    WHERE funcionario_id = v_func.id
    LIMIT 1;

    IF NOT FOUND THEN
      INSERT INTO public.acesso_cpf_logs(cpf, modulo, unidade, resultado, motivo, funcionario_id)
      VALUES (v_cpf_clean, v_link.modulo, v_link.unidade, 'negado', 'tecnico_nao_encontrado', v_func.id);
      RETURN jsonb_build_object('ok', false, 'error', 'tecnico_nao_encontrado');
    END IF;

    IF v_perm.link_status = 'revogado' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'revoked_link');
    END IF;

    IF v_perm.link_status = 'bloqueado' OR COALESCE(v_perm.link_bloqueado, false) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'blocked_link');
    END IF;

    IF COALESCE(v_perm.access_token, '') = '' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
    END IF;

    UPDATE public.links_acesso_publico
       SET ultimo_acesso_em = now(), total_acessos = total_acessos + 1
     WHERE id = v_link.id;

    INSERT INTO public.acesso_cpf_logs(cpf, modulo, unidade, resultado, motivo, funcionario_id)
    VALUES (v_cpf_clean, v_link.modulo, v_link.unidade, 'autorizado', '', v_func.id);

    RETURN jsonb_build_object(
      'ok', true,
      'modulo', 'operacional',
      'unidade', v_link.unidade,
      'link_nome', v_link.nome,
      'usuario', jsonb_build_object(
        'funcionario_id', v_func.id,
        'cpf', v_cpf_clean,
        'nome', v_func.nome,
        'empresa', v_empresa_nome,
        'cargo', v_func.cargo,
        'setor', COALESCE(v_func.setor, ''),
        'company_id', v_func.company_id
      ),
      'tecnico_token', v_perm.access_token
    );
  END IF;

  SELECT id, status, total_acessos
    INTO v_perm
  FROM public.funcionario_modulos
  WHERE funcionario_id = v_func.id
    AND modulo = v_link.modulo
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.acesso_cpf_logs(cpf, modulo, unidade, resultado, motivo, funcionario_id)
    VALUES (v_cpf_clean, v_link.modulo, v_link.unidade, 'negado', 'sem_permissao_modulo', v_func.id);
    RETURN jsonb_build_object('ok', false, 'error', 'sem_permissao_modulo');
  END IF;

  IF v_perm.status <> 'ativo' THEN
    INSERT INTO public.acesso_cpf_logs(cpf, modulo, unidade, resultado, motivo, funcionario_id)
    VALUES (v_cpf_clean, v_link.modulo, v_link.unidade, 'negado', 'modulo_bloqueado', v_func.id);
    RETURN jsonb_build_object('ok', false, 'error', 'modulo_bloqueado');
  END IF;

  UPDATE public.funcionario_modulos
     SET ultimo_acesso_em = now(), total_acessos = COALESCE(v_perm.total_acessos, 0) + 1
   WHERE id = v_perm.id;

  UPDATE public.links_acesso_publico
     SET ultimo_acesso_em = now(), total_acessos = total_acessos + 1
   WHERE id = v_link.id;

  INSERT INTO public.acesso_cpf_logs(cpf, modulo, unidade, resultado, motivo, funcionario_id)
  VALUES (v_cpf_clean, v_link.modulo, v_link.unidade, 'autorizado', '', v_func.id);

  RETURN jsonb_build_object(
    'ok', true,
    'modulo', v_link.modulo,
    'unidade', v_link.unidade,
    'link_nome', v_link.nome,
    'usuario', jsonb_build_object(
      'funcionario_id', v_func.id,
      'cpf', v_cpf_clean,
      'nome', v_func.nome,
      'empresa', v_empresa_nome,
      'cargo', v_func.cargo,
      'setor', COALESCE(v_func.setor, ''),
      'company_id', v_func.company_id
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validar_acesso_cpf_slug(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_acesso_cpf_slug(text, text) TO anon, authenticated, service_role;