-- ============== RESCISÕES ==============
CREATE TABLE public.rescisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid,
  funcionario_nome text NOT NULL DEFAULT '',
  company_id uuid,
  empresa_nome text NOT NULL DEFAULT '',
  cargo text NOT NULL DEFAULT '',
  data_admissao date,
  data_desligamento date NOT NULL,
  tipo_rescisao text NOT NULL DEFAULT 'sem_justa_causa',
  motivo text NOT NULL DEFAULT '',
  aviso_previo text NOT NULL DEFAULT 'indenizado',
  dias_aviso integer NOT NULL DEFAULT 0,
  salario_base numeric NOT NULL DEFAULT 0,
  dependentes integer NOT NULL DEFAULT 0,
  saldo_fgts_depositado numeric NOT NULL DEFAULT 0,
  saldo_salario numeric NOT NULL DEFAULT 0,
  aviso_previo_valor numeric NOT NULL DEFAULT 0,
  ferias_vencidas numeric NOT NULL DEFAULT 0,
  ferias_proporcionais numeric NOT NULL DEFAULT 0,
  terco_ferias numeric NOT NULL DEFAULT 0,
  decimo_terceiro numeric NOT NULL DEFAULT 0,
  inss numeric NOT NULL DEFAULT 0,
  irrf numeric NOT NULL DEFAULT 0,
  fgts_mes numeric NOT NULL DEFAULT 0,
  multa_fgts numeric NOT NULL DEFAULT 0,
  outros_descontos numeric NOT NULL DEFAULT 0,
  total_proventos numeric NOT NULL DEFAULT 0,
  total_descontos numeric NOT NULL DEFAULT 0,
  liquido numeric NOT NULL DEFAULT 0,
  observacoes text NOT NULL DEFAULT '',
  snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'rascunho',
  user_id uuid NOT NULL,
  usuario_nome text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rescisoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage rescisoes" ON public.rescisoes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Filial view own empresa rescisoes" ON public.rescisoes
  FOR SELECT TO authenticated
  USING (empresa_nome = ANY (get_user_empresas()));

CREATE POLICY "Filial insert own empresa rescisoes" ON public.rescisoes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_nome = ANY (get_user_empresas()));

CREATE POLICY "Filial update own empresa rescisoes" ON public.rescisoes
  FOR UPDATE TO authenticated
  USING (empresa_nome = ANY (get_user_empresas()));

CREATE TRIGGER trg_rescisoes_updated_at
  BEFORE UPDATE ON public.rescisoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== COMPRAS ==============
CREATE TABLE public.compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_solicitacao text NOT NULL DEFAULT '',
  data_solicitacao date NOT NULL DEFAULT CURRENT_DATE,
  company_id uuid,
  empresa_nome text NOT NULL DEFAULT '',
  solicitante_user_id uuid NOT NULL,
  solicitante_nome text NOT NULL DEFAULT '',
  centro_custo text NOT NULL DEFAULT '',
  fornecedor text NOT NULL DEFAULT '',
  item text NOT NULL DEFAULT '',
  quantidade numeric NOT NULL DEFAULT 1,
  unidade text NOT NULL DEFAULT 'un',
  valor_estimado numeric NOT NULL DEFAULT 0,
  valor_real numeric NOT NULL DEFAULT 0,
  observacao text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'solicitado',
  data_aprovacao date,
  data_compra date,
  data_entrega date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage compras" ON public.compras
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Filial view own empresa compras" ON public.compras
  FOR SELECT TO authenticated
  USING (empresa_nome = ANY (get_user_empresas()) OR solicitante_user_id = auth.uid());

CREATE POLICY "Filial insert own empresa compras" ON public.compras
  FOR INSERT TO authenticated
  WITH CHECK (empresa_nome = ANY (get_user_empresas()) AND solicitante_user_id = auth.uid());

CREATE POLICY "Filial update own empresa compras" ON public.compras
  FOR UPDATE TO authenticated
  USING (empresa_nome = ANY (get_user_empresas()));

CREATE TRIGGER trg_compras_updated_at
  BEFORE UPDATE ON public.compras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Histórico de status das compras
CREATE TABLE public.compras_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id uuid NOT NULL,
  status_anterior text NOT NULL DEFAULT '',
  status_novo text NOT NULL DEFAULT '',
  observacao text NOT NULL DEFAULT '',
  user_id uuid NOT NULL,
  usuario_nome text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.compras_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage compras_historico" ON public.compras_historico
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated view compras_historico" ON public.compras_historico
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated insert compras_historico" ON public.compras_historico
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
