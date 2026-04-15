
-- Create ativos table
CREATE TABLE public.ativos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('veiculo', 'compressor')),
  descricao TEXT NOT NULL DEFAULT '',
  placa TEXT DEFAULT '',
  patrimonio TEXT DEFAULT '',
  renavam TEXT DEFAULT '',
  chassi TEXT DEFAULT '',
  ano_fabricacao TEXT DEFAULT '',
  ano_modelo TEXT DEFAULT '',
  empresa TEXT DEFAULT '',
  arquivo_url TEXT DEFAULT '',
  observacao TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ativos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ativos" ON public.ativos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert ativos" ON public.ativos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update ativos" ON public.ativos FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete ativos" ON public.ativos FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_ativos_updated_at BEFORE UPDATE ON public.ativos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('documentos-ativos', 'documentos-ativos', true);

CREATE POLICY "Authenticated users can view docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documentos-ativos');
CREATE POLICY "Authenticated users can upload docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documentos-ativos');
CREATE POLICY "Authenticated users can update docs" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documentos-ativos');
CREATE POLICY "Authenticated users can delete docs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documentos-ativos');
