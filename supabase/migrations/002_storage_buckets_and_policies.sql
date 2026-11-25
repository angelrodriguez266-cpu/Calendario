-- ============================================================================
-- MIGRACIÓN 002: BUCKETS PRIVADOS DE SUPABASE STORAGE Y POLÍTICAS DE ACCESO
-- Proyecto: María y Ángel — Una Navidad juntos
-- ============================================================================
-- Los buckets `surprise-media` y `surprise-documents` son estrictamente privados
-- (`public = false`). Ningún archivo tiene URL pública permanente.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'surprise-media',
    'surprise-media',
    false,
    104857600, -- 100 MB
    ARRAY[
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'audio/mpeg',
      'audio/wav',
      'audio/x-wav',
      'audio/mp4',
      'audio/x-m4a'
    ]
  ),
  (
    'surprise-documents',
    'surprise-documents',
    false,
    26214400, -- 25 MB
    ARRAY['application/pdf']
  )
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Políticas de Storage: únicamente el administrador autorizado puede leer,
-- subir, reemplazar o eliminar objetos directamente.
-- La experiencia pública de María recibe URLs firmadas temporales emitidas por
-- el servidor tras validar sesión HttpOnly y fecha desbloqueada en America/Bogota.

DROP POLICY IF EXISTS "storage_admin_select" ON storage.objects;
CREATE POLICY "storage_admin_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id IN ('surprise-media', 'surprise-documents')
    AND public.is_authorized_admin()
  );

DROP POLICY IF EXISTS "storage_admin_insert" ON storage.objects;
CREATE POLICY "storage_admin_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('surprise-media', 'surprise-documents')
    AND public.is_authorized_admin()
  );

DROP POLICY IF EXISTS "storage_admin_update" ON storage.objects;
CREATE POLICY "storage_admin_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id IN ('surprise-media', 'surprise-documents')
    AND public.is_authorized_admin()
  )
  WITH CHECK (
    bucket_id IN ('surprise-media', 'surprise-documents')
    AND public.is_authorized_admin()
  );

DROP POLICY IF EXISTS "storage_admin_delete" ON storage.objects;
CREATE POLICY "storage_admin_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id IN ('surprise-media', 'surprise-documents')
    AND public.is_authorized_admin()
  );
