-- ========================================
-- AUTOMAÇÃO ERP DE FATURAMENTO
-- ========================================

-- 1) FUNÇÃO: gerar próxima medição de um contrato
CREATE OR REPLACE FUNCTION public.gerar_proxima_medicao(p_contrato_id uuid, p_competencia text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contrato RECORD;
  v_comp text;
  v_inicio date;
  v_fim date;
  v_med_id uuid;
  v_existente uuid;
BEGIN
  SELECT * INTO v_contrato FROM public.contratos WHERE id = p_contrato_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_contrato.status <> 'ativo' THEN RETURN NULL; END IF;

  v_comp := COALESCE(p_competencia, to_char(CURRENT_DATE, 'YYYY-MM'));

  -- Já existe medição (não cancelada) para esta competência?
  SELECT id INTO v_existente FROM public.medicoes
   WHERE contrato_id = p_contrato_id AND competencia = v_comp AND status <> 'cancelada' LIMIT 1;
  IF v_existente IS NOT NULL THEN RETURN v_existente; END IF;

  v_inicio := to_date(v_comp || '-01', 'YYYY-MM-DD');
  v_fim := (date_trunc('month', v_inicio) + INTERVAL '1 month - 1 day')::date;

  INSERT INTO public.medicoes(contrato_id, competencia, data_inicio, data_fim, total, status, observacoes)
  VALUES (p_contrato_id, v_comp, v_inicio, v_fim, COALESCE(v_contrato.valor_mensal,0), 'pendente',
          'Gerada automaticamente a partir do contrato ' || v_contrato.numero)
  RETURNING id INTO v_med_id;

  -- Itens automáticos a partir dos equipamentos ativos
  INSERT INTO public.medicao_itens(medicao_id, contrato_equipamento_id, descricao, quantidade, valor_unitario, ajuste, total)
  SELECT v_med_id, ce.id,
         COALESCE(NULLIF(ce.descricao_livre,''), 'Equipamento'),
         1, ce.valor_unitario, 0, ce.valor_unitario
    FROM public.contrato_equipamentos ce
   WHERE ce.contrato_id = p_contrato_id AND ce.status = 'ativo';

  -- Atualiza total se houve itens
  UPDATE public.medicoes m
     SET total = COALESCE((SELECT SUM(total) FROM public.medicao_itens WHERE medicao_id = m.id), v_contrato.valor_mensal)
   WHERE m.id = v_med_id;

  RETURN v_med_id;
END;
$$;

-- 2) TRIGGER: ao ativar contrato, gera primeira medição
CREATE OR REPLACE FUNCTION public.tg_contrato_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_nome text;
BEGIN
  SELECT COALESCE(nome_completo,email) INTO v_nome FROM public.profiles WHERE user_id=v_uid LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.faturamento_historico(user_id, usuario_nome, acao, entidade, entidade_id, contrato_id, cliente_id, detalhes)
    VALUES (COALESCE(v_uid, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(v_nome,'sistema'),
            'criado', 'contrato', NEW.id, NEW.id, NEW.cliente_id,
            jsonb_build_object('numero', NEW.numero, 'valor_mensal', NEW.valor_mensal, 'status', NEW.status));
    IF NEW.status = 'ativo' THEN
      PERFORM public.gerar_proxima_medicao(NEW.id, NULL);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.faturamento_historico(user_id, usuario_nome, acao, entidade, entidade_id, contrato_id, cliente_id, detalhes)
      VALUES (COALESCE(v_uid, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(v_nome,'sistema'),
              'status_alterado', 'contrato', NEW.id, NEW.id, NEW.cliente_id,
              jsonb_build_object('de', OLD.status, 'para', NEW.status));
      IF NEW.status = 'ativo' AND OLD.status <> 'ativo' THEN
        PERFORM public.gerar_proxima_medicao(NEW.id, NULL);
      END IF;
    END IF;
    IF NEW.valor_mensal IS DISTINCT FROM OLD.valor_mensal THEN
      INSERT INTO public.faturamento_historico(user_id, usuario_nome, acao, entidade, entidade_id, contrato_id, cliente_id, detalhes)
      VALUES (COALESCE(v_uid, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(v_nome,'sistema'),
              'valor_alterado', 'contrato', NEW.id, NEW.id, NEW.cliente_id,
              jsonb_build_object('de', OLD.valor_mensal, 'para', NEW.valor_mensal));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contrato_after_change ON public.contratos;
CREATE TRIGGER trg_contrato_after_change
AFTER INSERT OR UPDATE ON public.contratos
FOR EACH ROW EXECUTE FUNCTION public.tg_contrato_after_change();

-- 3) TRIGGER: ao aprovar medição → gera fatura + título a receber automaticamente
CREATE OR REPLACE FUNCTION public.tg_medicao_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_nome text;
  v_contrato RECORD;
  v_numero text;
  v_count int;
  v_venc date;
  v_fat_id uuid;
BEGIN
  SELECT COALESCE(nome_completo,email) INTO v_nome FROM public.profiles WHERE user_id=v_uid LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.faturamento_historico(user_id, usuario_nome, acao, entidade, entidade_id, contrato_id, detalhes)
    VALUES (COALESCE(v_uid, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(v_nome,'sistema'),
            'criado', 'medicao', NEW.id, NEW.contrato_id,
            jsonb_build_object('competencia', NEW.competencia, 'total', NEW.total));
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.faturamento_historico(user_id, usuario_nome, acao, entidade, entidade_id, contrato_id, detalhes)
    VALUES (COALESCE(v_uid, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(v_nome,'sistema'),
            'status_alterado', 'medicao', NEW.id, NEW.contrato_id,
            jsonb_build_object('de', OLD.status, 'para', NEW.status));

    -- Aprovou → gera fatura automática (se ainda não tem)
    IF NEW.status = 'aprovada' AND NEW.fatura_id IS NULL THEN
      SELECT * INTO v_contrato FROM public.contratos WHERE id = NEW.contrato_id;
      IF v_contrato.id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_count FROM public.faturas WHERE numero LIKE 'FAT-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-%';
        v_numero := 'FAT-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || lpad((v_count+1)::text, 4, '0');
        v_venc := COALESCE(
          (date_trunc('month', CURRENT_DATE) + ((COALESCE(v_contrato.dia_vencimento,10)-1) || ' days')::interval)::date,
          CURRENT_DATE + INTERVAL '15 days'
        )::date;
        IF v_venc < CURRENT_DATE THEN v_venc := CURRENT_DATE + INTERVAL '15 days'; END IF;

        INSERT INTO public.faturas(numero, cliente_id, contrato_id, empresa_id, medicao_id,
                                   competencia, data_vencimento, subtotal, total, status)
        VALUES (v_numero, v_contrato.cliente_id, v_contrato.id, v_contrato.empresa_id, NEW.id,
                NEW.competencia, v_venc, NEW.total, NEW.total, 'em_aberto')
        RETURNING id INTO v_fat_id;

        -- Itens da fatura espelhando os itens da medição
        INSERT INTO public.fatura_itens(fatura_id, contrato_equipamento_id, descricao, quantidade, valor_unitario, total)
        SELECT v_fat_id, mi.contrato_equipamento_id, mi.descricao, mi.quantidade, mi.valor_unitario, mi.total
          FROM public.medicao_itens mi WHERE mi.medicao_id = NEW.id;

        -- Título a receber
        INSERT INTO public.titulos_receber(cliente_id, contrato_id, fatura_id, empresa_id, numero,
                                           competencia, data_vencimento, valor_original, saldo, status)
        VALUES (v_contrato.cliente_id, v_contrato.id, v_fat_id, v_contrato.empresa_id, v_numero,
                NEW.competencia, v_venc, NEW.total, NEW.total, 'aberto');

        -- Vincula fatura à medição e marca como faturada
        UPDATE public.medicoes SET fatura_id = v_fat_id, status = 'faturada' WHERE id = NEW.id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_medicao_after_change ON public.medicoes;
CREATE TRIGGER trg_medicao_after_change
AFTER INSERT OR UPDATE ON public.medicoes
FOR EACH ROW EXECUTE FUNCTION public.tg_medicao_after_change();

-- 4) TRIGGER: histórico em faturas
CREATE OR REPLACE FUNCTION public.tg_fatura_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_nome text;
BEGIN
  SELECT COALESCE(nome_completo,email) INTO v_nome FROM public.profiles WHERE user_id=v_uid LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.faturamento_historico(user_id, usuario_nome, acao, entidade, entidade_id, contrato_id, cliente_id, fatura_id, detalhes)
    VALUES (COALESCE(v_uid, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(v_nome,'sistema'),
            'criada', 'fatura', NEW.id, NEW.contrato_id, NEW.cliente_id, NEW.id,
            jsonb_build_object('numero', NEW.numero, 'total', NEW.total, 'vencimento', NEW.data_vencimento));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.faturamento_historico(user_id, usuario_nome, acao, entidade, entidade_id, contrato_id, cliente_id, fatura_id, detalhes)
      VALUES (COALESCE(v_uid, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(v_nome,'sistema'),
              'status_alterado', 'fatura', NEW.id, NEW.contrato_id, NEW.cliente_id, NEW.id,
              jsonb_build_object('de', OLD.status, 'para', NEW.status));
    END IF;
    IF NEW.data_pagamento IS DISTINCT FROM OLD.data_pagamento AND NEW.data_pagamento IS NOT NULL THEN
      INSERT INTO public.faturamento_historico(user_id, usuario_nome, acao, entidade, entidade_id, contrato_id, cliente_id, fatura_id, detalhes)
      VALUES (COALESCE(v_uid, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(v_nome,'sistema'),
              'paga', 'fatura', NEW.id, NEW.contrato_id, NEW.cliente_id, NEW.id,
              jsonb_build_object('data_pagamento', NEW.data_pagamento, 'valor', NEW.valor_pago));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fatura_after_change ON public.faturas;
CREATE TRIGGER trg_fatura_after_change
AFTER INSERT OR UPDATE ON public.faturas
FOR EACH ROW EXECUTE FUNCTION public.tg_fatura_after_change();

-- 5) TRIGGER: histórico em cobranças
CREATE OR REPLACE FUNCTION public.tg_cobranca_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titulo RECORD;
BEGIN
  SELECT cliente_id, contrato_id, fatura_id INTO v_titulo
    FROM public.titulos_receber WHERE id = NEW.titulo_id;
  INSERT INTO public.faturamento_historico(user_id, usuario_nome, acao, entidade, entidade_id, contrato_id, cliente_id, fatura_id, detalhes)
  VALUES (COALESCE(NEW.user_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(NEW.usuario_nome,'sistema'),
          'cobranca_enviada', 'cobranca', NEW.id, v_titulo.contrato_id, v_titulo.cliente_id, v_titulo.fatura_id,
          jsonb_build_object('canal', NEW.canal, 'resultado', NEW.resultado, 'observacao', NEW.observacao));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cobranca_after_insert ON public.cobrancas_tentativas;
CREATE TRIGGER trg_cobranca_after_insert
AFTER INSERT ON public.cobrancas_tentativas
FOR EACH ROW EXECUTE FUNCTION public.tg_cobranca_after_insert();

-- 6) FUNÇÃO: marcar faturas vencidas
CREATE OR REPLACE FUNCTION public.faturamento_marcar_vencidas()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  UPDATE public.faturas
     SET status = 'vencida'
   WHERE status = 'em_aberto'
     AND data_vencimento < CURRENT_DATE
     AND data_pagamento IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 7) FUNÇÃO: KPIs do dashboard vivo
CREATE OR REPLACE FUNCTION public.dashboard_faturamento_kpis()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comp text := to_char(CURRENT_DATE, 'YYYY-MM');
  v_total_mes numeric;
  v_pendente numeric;
  v_previsto numeric;
  v_contratos_ativos int;
  v_vencidas int;
  v_a_vencer int;
  v_inadimplentes int;
  v_med_pendentes int;
BEGIN
  PERFORM public.faturamento_marcar_vencidas();

  SELECT COALESCE(SUM(total),0) INTO v_total_mes
    FROM public.faturas WHERE competencia = v_comp AND status NOT IN ('cancelada');

  SELECT COALESCE(SUM(total - COALESCE(valor_pago,0)),0) INTO v_pendente
    FROM public.faturas WHERE status IN ('em_aberto','vencida');

  SELECT COALESCE(SUM(valor_mensal),0) INTO v_previsto
    FROM public.contratos WHERE status = 'ativo';

  SELECT COUNT(*) INTO v_contratos_ativos FROM public.contratos WHERE status = 'ativo';

  SELECT COUNT(*) INTO v_vencidas FROM public.faturas WHERE status = 'vencida';
  SELECT COUNT(*) INTO v_a_vencer FROM public.faturas
    WHERE status = 'em_aberto' AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days';

  SELECT COUNT(DISTINCT cliente_id) INTO v_inadimplentes FROM public.faturas WHERE status = 'vencida';
  SELECT COUNT(*) INTO v_med_pendentes FROM public.medicoes WHERE status IN ('pendente','em_revisao');

  RETURN jsonb_build_object(
    'competencia', v_comp,
    'total_faturado_mes', v_total_mes,
    'total_pendente', v_pendente,
    'valor_previsto_mes', v_previsto,
    'contratos_ativos', v_contratos_ativos,
    'cobrancas_vencidas', v_vencidas,
    'cobrancas_a_vencer', v_a_vencer,
    'clientes_inadimplentes', v_inadimplentes,
    'medicoes_pendentes', v_med_pendentes
  );
END;
$$;

-- 8) FUNÇÃO: gerar medições do mês corrente para todos contratos ativos (uso manual)
CREATE OR REPLACE FUNCTION public.faturamento_gerar_medicoes_mes(p_competencia text DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  v_count int := 0;
  v_med_id uuid;
BEGIN
  FOR c IN SELECT id FROM public.contratos WHERE status='ativo' LOOP
    v_med_id := public.gerar_proxima_medicao(c.id, p_competencia);
    IF v_med_id IS NOT NULL THEN v_count := v_count + 1; END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 9) VIEW: conferência operacional
CREATE OR REPLACE VIEW public.vw_faturamento_conferencia AS
SELECT
  f.id, f.numero, f.competencia, f.data_emissao, f.data_vencimento, f.total, f.valor_pago,
  f.status, f.observacoes,
  c.numero AS contrato_numero, c.dia_vencimento,
  cl.razao_social AS cliente_nome, cl.cnpj_cpf AS cliente_doc,
  e.nome AS empresa_nome,
  m.id AS medicao_id, m.data_inicio AS periodo_inicio, m.data_fim AS periodo_fim
FROM public.faturas f
LEFT JOIN public.contratos c ON c.id = f.contrato_id
LEFT JOIN public.clientes_fat cl ON cl.id = f.cliente_id
LEFT JOIN public.empresas e ON e.id = f.empresa_id
LEFT JOIN public.medicoes m ON m.id = f.medicao_id;

GRANT SELECT ON public.vw_faturamento_conferencia TO authenticated;