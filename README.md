# María y Ángel: una Navidad juntos

Experiencia web privada, romántica e interactiva con calendario de Adviento digital de **31 días** para diciembre de 2026 (`America/Bogota`) y **Panel de Administración Privado** en `/admin` integrado con **Supabase**.

---

## 1. Inicio rápido en local

```bash
npm run dev
```

- **Experiencia de María**: `http://localhost:3000`
- **Panel de administración de Ángel**: `http://localhost:3000/admin` (oculto de la navegación pública y protegido en el servidor).

---

## 2. Configuración de Supabase (requerida para activar `/admin` en producción)

### Paso A — Ejecutar migraciones SQL y buckets privados
En el **SQL Editor** de tu proyecto Supabase, ejecuta en orden:
1. [supabase/migrations/001_initial_schema_and_rls.sql](supabase/migrations/001_initial_schema_and_rls.sql) — crea `admin_users`, `calendar_days` (con los 31 días de diciembre 2026 a las `00:00 America/Bogota`), `surprises`, `surprise_files`, índices, triggers y **RLS estricto** en todas las tablas.
2. [supabase/migrations/002_storage_buckets_and_policies.sql](supabase/migrations/002_storage_buckets_and_policies.sql) — crea los buckets privados `surprise-media` y `surprise-documents` (`public = false`) y sus políticas de Storage.

### Paso B — Crear tu cuenta de administrador y autorizarla
1. En Supabase Dashboard ve a **Authentication → Users → Add user** y crea tu cuenta con correo y contraseña (marca *Auto Confirm User*).
2. Copia el **User UID** de esa cuenta y regístrala explícitamente en `public.admin_users` desde el SQL Editor (nunca se usa `user_metadata` para permisos):
   ```sql
   INSERT INTO public.admin_users (user_id, email)
   VALUES ('PEGA-AQUI-TU-UUID-DE-AUTH', 'tu-correo@ejemplo.com');
   ```

### Paso C — Configurar variables de entorno
Copia [.env.example](.env.example) a `.env.local` (o configúralas en tu plataforma de despliegue):
- `CALENDAR_PASSWORD_HASH`: hash `scrypt` de la clave privada de María (`npm run hash-password -- "tu-clave"`).
- `SESSION_SECRET`: secreto aleatorio (≥ 32 caracteres) para firmar cookies `HttpOnly`.
- `SUPABASE_URL`: URL de tu proyecto (`https://<ref>.supabase.co`).
- `SUPABASE_PUBLISHABLE_KEY`: clave publicable (`anon` / publishable key).
- `SUPABASE_SERVICE_ROLE_KEY`: clave privilegiada **exclusiva del servidor** (nunca exponer en el navegador).
- `ADMIN_ALLOWED_EMAILS`: tu correo de administrador autorizado (ej. `tu-correo@ejemplo.com`).

---

## 3. Reemplazar la fotografía temporal de portada

1. Guarda su fotografía definitiva en `public/images/`.
2. Actualiza `hero.imageSrc` y cambia `hero.isTemporaryReference` a `false` en `public/js/config/siteConfig.js`.
