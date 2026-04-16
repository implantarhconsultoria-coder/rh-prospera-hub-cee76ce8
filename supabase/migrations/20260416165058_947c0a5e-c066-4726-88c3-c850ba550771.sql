
INSERT INTO storage.buckets (id, name, public) VALUES ('documentos-funcionarios', 'documentos-funcionarios', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload documentos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documentos-funcionarios');

CREATE POLICY "Anyone can view documentos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documentos-funcionarios');
