
-- =========================
-- APONTAMENTO CONTABILIDADE — novas colunas
-- =========================
ALTER TABLE public.apontamentos_contabilidade_itens
  ADD COLUMN IF NOT EXISTS hora_extra_50 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hora_extra_50_horas numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hora_extra_60_horas numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hora_extra_100_horas numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS faltas_qtd numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_falta numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dsr_qtd numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_dsr numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adiantamento numeric NOT NULL DEFAULT 0;

-- Detalhe por funcionário (faltas/DSR)
CREATE TABLE IF NOT EXISTS public.apontamento_falta_dsr_detalhe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apontamento_item_id uuid NOT NULL REFERENCES public.apontamentos_contabilidade_itens(id) ON DELETE CASCADE,
  funcionario_id uuid REFERENCES public.funcionarios(id),
  data date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('falta','atestado','justificado','ausencia','dsr')),
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('ponto','importacao','manual')),
  observacao text,
  ajustado_por_nome text,
  ajustado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.apontamento_falta_dsr_detalhe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_falta_dsr" ON public.apontamento_falta_dsr_detalhe
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================
-- RESCISOES — rubricas TRCT
-- =========================
ALTER TABLE public.rescisoes
  -- empregador
  ADD COLUMN IF NOT EXISTS empresa_cnpj text,
  ADD COLUMN IF NOT EXISTS empresa_endereco text,
  ADD COLUMN IF NOT EXISTS empresa_bairro text,
  ADD COLUMN IF NOT EXISTS empresa_municipio text,
  ADD COLUMN IF NOT EXISTS empresa_uf text,
  ADD COLUMN IF NOT EXISTS empresa_cep text,
  ADD COLUMN IF NOT EXISTS empresa_cnae text,
  -- trabalhador
  ADD COLUMN IF NOT EXISTS pis_pasep text,
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS municipio text,
  ADD COLUMN IF NOT EXISTS uf text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS ctps text,
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS nome_mae text,
  -- contrato
  ADD COLUMN IF NOT EXISTS tipo_contrato text,
  ADD COLUMN IF NOT EXISTS causa_afastamento text,
  ADD COLUMN IF NOT EXISTS codigo_afastamento text,
  ADD COLUMN IF NOT EXISTS categoria_trabalhador text,
  ADD COLUMN IF NOT EXISTS remuneracao_mes_anterior numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_aviso date,
  ADD COLUMN IF NOT EXISTS pensao_trct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pensao_fgts numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS codigo_sindical text,
  ADD COLUMN IF NOT EXISTS sindicato_cnpj text,
  ADD COLUMN IF NOT EXISTS sindicato_nome text,
  -- VERBAS RESCISÓRIAS (TRCT)
  ADD COLUMN IF NOT EXISTS verba_50_saldo_dias numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verba_51_comissoes numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verba_52_gratificacao numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verba_53_insalubridade numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verba_54_periculosidade numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verba_55_adic_noturno numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verba_56_horas_extras numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verba_57_gorjetas numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verba_58_dsr numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verba_59_reflexo_dsr numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verba_60_multa_477 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verba_61_multa_479 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verba_62_salario_familia numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verba_63_13_proporcional numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verba_64_13_exercicio numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verba_65_ferias_proporcionais numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verba_66_ferias_vencidas numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verba_68_terco_ferias numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verba_69_aviso_indenizado numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verba_70_13_sobre_aviso numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verba_71_ferias_sobre_aviso numeric DEFAULT 0,
  -- DEDUÇÕES
  ADD COLUMN IF NOT EXISTS ded_100_pensao numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ded_101_adiantamento numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ded_102_adiant_13 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ded_103_aviso_indenizado numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ded_104_indenizacao_480 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ded_105_emprestimo_consig numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ded_106_vale_transporte numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ded_112_1_inss numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ded_112_2_inss_13 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ded_114_1_irrf numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ded_114_2_irrf_13 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ded_115_2_arredondamento numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ded_115_3_vale_refeicao numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_bruto numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_dedu numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS liquido_rescisorio numeric DEFAULT 0;

-- Histórico de alteração de rescisão (rubricas)
CREATE TABLE IF NOT EXISTS public.rescisao_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rescisao_id uuid NOT NULL REFERENCES public.rescisoes(id) ON DELETE CASCADE,
  funcionario_id uuid,
  funcionario_nome text,
  cpf text,
  empresa text,
  acao text NOT NULL,
  rubrica text,
  valor_anterior numeric,
  valor_novo numeric,
  observacao text,
  user_id uuid,
  user_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rescisao_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_rescisao_hist" ON public.rescisao_historico
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Tornar user_id da rescisao opcional (para edição via admin sem reinserir)
ALTER TABLE public.rescisoes ALTER COLUMN user_id DROP NOT NULL;
