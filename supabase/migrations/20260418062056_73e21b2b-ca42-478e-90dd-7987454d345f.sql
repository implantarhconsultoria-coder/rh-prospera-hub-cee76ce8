-- Tabela de técnicos de campo (mecânicos externos)
CREATE TABLE IF NOT EXISTS public.tecnicos_campo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  user_id uuid,
  veiculo_id uuid REFERENCES public.veiculos(id) ON DELETE SET NULL,
  apelido text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'aguardando_acesso',
  observacoes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(funcionario_id)
);

ALTER TABLE public.tecnicos_campo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage tecnicos_campo" ON public.tecnicos_campo
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Operacional manage tecnicos_campo" ON public.tecnicos_campo
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'operacional'::app_role))
  WITH CHECK (has_role(auth.uid(), 'operacional'::app_role));

CREATE POLICY "Tecnico view own profile" ON public.tecnicos_campo
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_tecnicos_campo_updated
  BEFORE UPDATE ON public.tecnicos_campo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Pré-cadastro dos 8 mecânicos solicitados
INSERT INTO public.tecnicos_campo (funcionario_id, apelido, status)
VALUES
  ('05adf248-98e8-4e4a-b53c-bdfe081d6c2c', 'Tiago Moreira', 'aguardando_acesso'),
  ('ff1ff83d-2380-42db-a1b2-253bb4c37166', 'Tiago Toledo', 'aguardando_acesso'),
  ('11143c9c-05c9-4c3c-8b77-2e20b8951702', 'Diego', 'aguardando_acesso'),
  ('21a652d7-7741-4cb3-b17a-9863ce91e3ce', 'Leandro', 'aguardando_acesso'),
  ('43593a02-405b-4cb2-8264-ac6f14629141', 'Rafael', 'aguardando_acesso'),
  ('297b9f6c-c3a0-4073-91e9-e24db12c20b5', 'Jerri', 'aguardando_acesso'),
  ('91120f1f-790f-4425-90c6-b875a5a7b64a', 'Naciel', 'aguardando_acesso'),
  ('43582c17-2ac2-4b0a-8a9a-7f6a6fd9ced9', 'Vitor', 'aguardando_acesso')
ON CONFLICT (funcionario_id) DO NOTHING;