-- Bucket privado para arquivos do módulo Documentos (e fotos de visitas)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos-bj7',
  'documentos-bj7',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Políticas: usuários autenticados podem ler/escrever em todo o bucket.
-- (controle granular fica no app — aqui mantemos compartilhado entre os usuários do grupo)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'docs_bj7_read') THEN
    CREATE POLICY docs_bj7_read ON storage.objects FOR SELECT
      TO authenticated USING (bucket_id = 'documentos-bj7');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'docs_bj7_write') THEN
    CREATE POLICY docs_bj7_write ON storage.objects FOR INSERT
      TO authenticated WITH CHECK (bucket_id = 'documentos-bj7');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'docs_bj7_update') THEN
    CREATE POLICY docs_bj7_update ON storage.objects FOR UPDATE
      TO authenticated USING (bucket_id = 'documentos-bj7');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'docs_bj7_delete') THEN
    CREATE POLICY docs_bj7_delete ON storage.objects FOR DELETE
      TO authenticated USING (bucket_id = 'documentos-bj7');
  END IF;
END $$;
