-- ============================================================================
-- MIGRACIÓN 001: ESQUEMA DEL CALENDARIO DE ADVIENTO Y SEGURIDAD RLS
-- Proyecto: María y Ángel — Una Navidad juntos
-- ============================================================================
-- Ejecutar en Supabase SQL Editor.
-- Garantiza privacidad total: ningún usuario anónimo ni usuario autenticado no
-- autorizado puede consultar o modificar las tablas privadas.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. TABLA DE ADMINISTRADORES AUTORIZADOS (FUENTE DE VERDAD EN BASE DE DATOS)
--    Nunca se utiliza `user_metadata` para autorización.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Función auxiliar verificada en RLS sin exponer la tabla completa
CREATE OR REPLACE FUNCTION public.is_authorized_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_authorized_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_authorized_admin() TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. TABLA: calendar_days (31 días de diciembre de 2026 — America/Bogota)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_number INTEGER NOT NULL UNIQUE CHECK (day_number BETWEEN 1 AND 31),
  unlock_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_days_day_number ON public.calendar_days(day_number);
CREATE INDEX IF NOT EXISTS idx_calendar_days_unlock_at ON public.calendar_days(unlock_at);

-- ----------------------------------------------------------------------------
-- 3. TABLA: surprises (sorpresas programables e independientes del desbloqueo)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.surprises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_day_id UUID NOT NULL UNIQUE REFERENCES public.calendar_days(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  content_type TEXT NOT NULL CHECK (
    content_type IN ('letter', 'video', 'audio', 'gallery', 'coupon', 'special')
  ),
  content_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'scheduled', 'published')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_surprises_calendar_day_id ON public.surprises(calendar_day_id);
CREATE INDEX IF NOT EXISTS idx_surprises_status ON public.surprises(status);
CREATE INDEX IF NOT EXISTS idx_surprises_content_type ON public.surprises(content_type);

-- ----------------------------------------------------------------------------
-- 4. TABLA: surprise_files (metadatos de archivos en Storage privado)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.surprise_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surprise_id UUID NOT NULL REFERENCES public.surprises(id) ON DELETE CASCADE,
  bucket_name TEXT NOT NULL CHECK (
    bucket_name IN ('surprise-media', 'surprise-documents')
  ),
  storage_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  media_role TEXT NOT NULL DEFAULT 'primary' CHECK (
    media_role IN ('primary', 'cover', 'gallery_item', 'attachment_image', 'pdf_document', 'extra')
  ),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_surprise_files_surprise_order
  ON public.surprise_files(surprise_id, display_order);

-- ----------------------------------------------------------------------------
-- 5. TRIGGERS AUTOMÁTICOS DE updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calendar_days_updated_at ON public.calendar_days;
CREATE TRIGGER trg_calendar_days_updated_at
  BEFORE UPDATE ON public.calendar_days
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_surprises_updated_at ON public.surprises;
CREATE TRIGGER trg_surprises_updated_at
  BEFORE UPDATE ON public.surprises
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. SEMILLA INICIAL DE LOS 31 DÍAS DE DICIEMBRE DE 2026 (00:00 America/Bogota)
-- ----------------------------------------------------------------------------
INSERT INTO public.calendar_days (day_number, unlock_at)
SELECT
  d,
  make_timestamptz(2026, 12, d, 0, 0, 0, 'America/Bogota')
FROM generate_series(1, 31) AS d
ON CONFLICT (day_number) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) ESTRICTO EN TODAS LAS TABLAS
-- ----------------------------------------------------------------------------
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surprises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surprise_files ENABLE ROW LEVEL SECURITY;

-- Revocar acceso directo a rol anónimo
REVOKE ALL ON public.admin_users FROM anon;
REVOKE ALL ON public.calendar_days FROM anon;
REVOKE ALL ON public.surprises FROM anon;
REVOKE ALL ON public.surprise_files FROM anon;

-- admin_users: un administrador solo puede verificar su propio registro (nunca auto-insertarse)
DROP POLICY IF EXISTS "admin_users_select_own" ON public.admin_users;
CREATE POLICY "admin_users_select_own"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- calendar_days: solo administrador autorizado
DROP POLICY IF EXISTS "calendar_days_admin_all" ON public.calendar_days;
CREATE POLICY "calendar_days_admin_all"
  ON public.calendar_days
  FOR ALL
  TO authenticated
  USING (public.is_authorized_admin())
  WITH CHECK (public.is_authorized_admin());

-- surprises: solo administrador autorizado
DROP POLICY IF EXISTS "surprises_admin_all" ON public.surprises;
CREATE POLICY "surprises_admin_all"
  ON public.surprises
  FOR ALL
  TO authenticated
  USING (public.is_authorized_admin())
  WITH CHECK (public.is_authorized_admin());

-- surprise_files: solo administrador autorizado
DROP POLICY IF EXISTS "surprise_files_admin_all" ON public.surprise_files;
CREATE POLICY "surprise_files_admin_all"
  ON public.surprise_files
  FOR ALL
  TO authenticated
  USING (public.is_authorized_admin())
  WITH CHECK (public.is_authorized_admin());
