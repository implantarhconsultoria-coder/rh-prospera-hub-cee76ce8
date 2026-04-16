
CREATE TABLE public.documentos_funcionario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL,
  funcionario_nome TEXT NOT NULL DEFAULT '',
  company_id UUID NOT NULL,
  empresa_nome TEXT NOT NULL DEFAULT '',
  tipo_documento TEXT NOT NULL DEFAULT '',
  competencia TEXT DEFAULT '',
  descricao TEXT DEFAULT '',
  arquivo_url TEXT DEFAULT '',
  gerado_por_user_id UUID NOT NULL,
  gerado_por_nome TEXT NOT NULL DEFAULT '',
  enviado_por_user_id UUID,
  enviado_por_nome TEXT DEFAULT '',
  enviado_em TIMESTAMP WITH TIME ZONE,
  destinatarios TEXT DEFAULT '',
  status_envio TEXT NOT NULL DEFAULT 'gerado',
  unidade TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.documentos_funcionario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage all documentos"
  ON public.documentos_funcionario FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Filial users can view own empresa documentos"
  ON public.documentos_funcionario FOR SELECT
  TO authenticated
  USING (empresa_nome = ANY (public.get_user_empresas()));

CREATE POLICY "Filial users can insert own empresa documentos"
  ON public.documentos_funcionario FOR INSERT
  TO authenticated
  WITH CHECK (empresa_nome = ANY (public.get_user_empresas()));

CREATE POLICY "Filial users can update own empresa documentos"
  ON public.documentos_funcionario FOR UPDATE
  TO authenticated
  USING (empresa_nome = ANY (public.get_user_empresas()));

CREATE TRIGGER update_documentos_funcionario_updated_at
  BEFORE UPDATE ON public.documentos_funcionario
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
