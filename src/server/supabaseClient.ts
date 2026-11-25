import type {
  AdminContentType,
  AdminDayDetail,
  AdminDaySummary,
  AdminDashboardStats,
  CalendarDayRow,
  MediaRole,
  StorageBucketName,
  SurpriseFileRow,
  SurpriseFileWithUrl,
  SurpriseRow,
  SurpriseStatus,
} from '../types/admin.ts';
import type { BogotaClockSnapshot, UnlockedDayDetailDTO } from '../types/calendar.ts';

const TUS_CHUNK_THRESHOLD_BYTES = 6 * 1024 * 1024; // 6 MB -> carga reanudable/por partes
const TUS_CHUNK_SIZE_BYTES = 2 * 1024 * 1024;

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '') || '';
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  const allowedEmails = (process.env.ADMIN_ALLOWED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return { url, publishableKey, serviceRoleKey, allowedEmails };
}

export function isSupabaseConfigured(): boolean {
  const { url, publishableKey, serviceRoleKey } = getSupabaseEnv();
  return Boolean(
    url &&
      (url.startsWith('https://') || url.startsWith('http://')) &&
      publishableKey.length >= 16 &&
      serviceRoleKey.length >= 16
  );
}

export function getSupabaseStatusSummary() {
  const { url, publishableKey, serviceRoleKey, allowedEmails } = getSupabaseEnv();
  return {
    configured: isSupabaseConfigured(),
    hasUrl: Boolean(url),
    hasPublishableKey: Boolean(publishableKey),
    hasServiceRoleKey: Boolean(serviceRoleKey),
    allowedEmailsCount: allowedEmails.length,
  };
}

async function supabaseRest<T>(
  restPath: string,
  options: {
    method?: string;
    body?: unknown;
    prefer?: string;
  } = {}
): Promise<T> {
  const { url, serviceRoleKey } = getSupabaseEnv();
  const headers: Record<string, string> = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };
  if (options.prefer) {
    headers.Prefer = options.prefer;
  }

  const res = await fetch(`${url}/rest/v1/${restPath}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Supabase REST ${res.status}: ${errText}`);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/**
 * Autentica al administrador usando Supabase Auth (`/auth/v1/token?grant_type=password`)
 * y valida autorización estricta contra `public.admin_users` y `ADMIN_ALLOWED_EMAILS`.
 * Nunca confía en `user_metadata`.
 */
export async function authenticateAdminWithSupabase(
  email: string,
  password: string
): Promise<
  | { ok: true; uid: string; email: string }
  | { ok: false; status: number; code: string; message: string }
> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      status: 503,
      code: 'SUPABASE_NOT_CONFIGURED',
      message:
        'Supabase aún no está configurado en el servidor. Define SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY y ADMIN_ALLOWED_EMAILS en .env.local.',
    };
  }

  const { url, publishableKey, allowedEmails } = getSupabaseEnv();
  const normalizedEmail = email.trim().toLowerCase();

  let authRes: Response;
  try {
    authRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: publishableKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: normalizedEmail,
        password,
      }),
    });
  } catch {
    return {
      ok: false,
      status: 502,
      code: 'SUPABASE_UNREACHABLE',
      message: 'No fue posible conectar con Supabase Auth. Verifica SUPABASE_URL y tu conexión.',
    };
  }

  if (!authRes.ok) {
    return {
      ok: false,
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Correo o contraseña incorrectos.',
    };
  }

  const authData = (await authRes.json()) as {
    user?: { id?: string; email?: string };
  };

  const userId = authData.user?.id;
  const userEmail = authData.user?.email?.toLowerCase();

  if (!userId || !userEmail) {
    return {
      ok: false,
      status: 401,
      code: 'INVALID_SESSION',
      message: 'Supabase Auth no devolvió un usuario válido.',
    };
  }

  // 1. Verificar lista blanca en variables de entorno (si está definida)
  if (allowedEmails.length > 0 && !allowedEmails.includes(userEmail)) {
    return {
      ok: false,
      status: 403,
      code: 'NOT_AUTHORIZED_ADMIN',
      message: 'Esta cuenta no está autorizada para acceder al panel de administración.',
    };
  }

  // 2. Verificar autorización explícita en tabla `public.admin_users` (nunca user_metadata)
  try {
    const rows = await supabaseRest<Array<{ user_id: string; email: string }>>(
      `admin_users?user_id=eq.${encodeURIComponent(userId)}&select=user_id,email`
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return {
        ok: false,
        status: 403,
        code: 'NOT_AUTHORIZED_ADMIN',
        message: 'Esta cuenta no tiene permisos de administrador asignados en admin_users.',
      };
    }
  } catch {
    return {
      ok: false,
      status: 503,
      code: 'ADMIN_TABLE_UNAVAILABLE',
      message:
        'No se pudo verificar la tabla admin_users en Supabase. Asegúrate de ejecutar las migraciones SQL.',
    };
  }

  return { ok: true, uid: userId, email: userEmail };
}

/**
 * Re-verifica autorización del administrador en la base de datos para operaciones sensibles.
 */
export async function verifyAdminAuthorizationInDb(uid: string, email: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { allowedEmails } = getSupabaseEnv();
  if (allowedEmails.length > 0 && !allowedEmails.includes(email.toLowerCase())) {
    return false;
  }
  try {
    const rows = await supabaseRest<Array<{ user_id: string }>>(
      `admin_users?user_id=eq.${encodeURIComponent(uid)}&select=user_id`
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

export async function createSignedStorageUrl(
  bucket: StorageBucketName,
  storagePath: string,
  expiresInSeconds = 600
): Promise<string | null> {
  const { url, serviceRoleKey } = getSupabaseEnv();
  const encodedPath = storagePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  try {
    const res = await fetch(
      `${url}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodedPath}`,
      {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: expiresInSeconds }),
      }
    );

    if (!res.ok) return null;
    const data = (await res.json()) as { signedURL?: string; signedUrl?: string };
    const rel = data.signedURL || data.signedUrl;
    if (!rel) return null;
    if (rel.startsWith('http://') || rel.startsWith('https://')) {
      return rel;
    }
    return `${url}/storage/v1${rel.startsWith('/') ? '' : '/'}${rel}`;
  } catch {
    return null;
  }
}

/**
 * Subida protegida a Supabase Storage.
 * Usa carga directa para archivos <= 6 MB y carga reanudable por partes (TUS)
 * para archivos grandes (> 6 MB).
 */
export async function uploadBufferToSupabaseStorage(params: {
  bucket: StorageBucketName;
  storagePath: string;
  buffer: Buffer;
  contentType: string;
}): Promise<void> {
  const { url, serviceRoleKey } = getSupabaseEnv();

  if (params.buffer.byteLength > TUS_CHUNK_THRESHOLD_BYTES) {
    const metadataHeader = [
      `bucketName ${Buffer.from(params.bucket).toString('base64')}`,
      `objectName ${Buffer.from(params.storagePath).toString('base64')}`,
      `contentType ${Buffer.from(params.contentType).toString('base64')}`,
    ].join(',');

    const createRes = await fetch(`${url}/storage/v1/upload/resumable`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Tus-Resumable': '1.0.0',
        'Upload-Length': String(params.buffer.byteLength),
        'Upload-Metadata': metadataHeader,
        'x-upsert': 'true',
      },
    });

    if (createRes.ok) {
      const location = createRes.headers.get('location');
      if (location) {
        const uploadUrl = location.startsWith('http')
          ? location
          : `${url}${location.startsWith('/') ? '' : '/'}${location}`;

        let offset = 0;
        while (offset < params.buffer.byteLength) {
          const chunk = params.buffer.subarray(
            offset,
            Math.min(offset + TUS_CHUNK_SIZE_BYTES, params.buffer.byteLength)
          );
          const patchRes = await fetch(uploadUrl, {
            method: 'PATCH',
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
              'Tus-Resumable': '1.0.0',
              'Upload-Offset': String(offset),
              'Content-Type': 'application/offset+octet-stream',
            },
            body: chunk,
          });
          if (!patchRes.ok) {
            throw new Error(`Error en carga por partes TUS (${patchRes.status})`);
          }
          offset += chunk.byteLength;
        }
        return;
      }
    }
  }

  const encodedPath = params.storagePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  const res = await fetch(
    `${url}/storage/v1/object/${encodeURIComponent(params.bucket)}/${encodedPath}`,
    {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': params.contentType,
        'x-upsert': 'true',
      },
      body: params.buffer,
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Error subiendo archivo a Storage (${res.status}): ${errText}`);
  }
}

export async function deleteObjectFromSupabaseStorage(
  bucket: StorageBucketName,
  storagePath: string
): Promise<void> {
  const { url, serviceRoleKey } = getSupabaseEnv();
  await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}`, {
    method: 'DELETE',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefixes: [storagePath] }),
  });
}

export async function listAllAdminCalendarDays(): Promise<AdminDaySummary[]> {
  const [days, surprises, files] = await Promise.all([
    supabaseRest<CalendarDayRow[]>(
      'calendar_days?select=*&order=day_number.asc'
    ),
    supabaseRest<SurpriseRow[]>('surprises?select=*'),
    supabaseRest<Array<{ id: string; surprise_id: string }>>(
      'surprise_files?select=id,surprise_id'
    ),
  ]);

  const surpriseByDayId = new Map<string, SurpriseRow>();
  for (const s of surprises || []) {
    surpriseByDayId.set(s.calendar_day_id, s);
  }

  const fileCountBySurpriseId = new Map<string, number>();
  for (const f of files || []) {
    fileCountBySurpriseId.set(
      f.surprise_id,
      (fileCountBySurpriseId.get(f.surprise_id) ?? 0) + 1
    );
  }

  return (days || []).map((day) => {
    const s = surpriseByDayId.get(day.id) ?? null;
    return {
      day_id: day.id,
      day_number: day.day_number,
      unlock_at: day.unlock_at,
      date_label: `${day.day_number} de diciembre de 2026`,
      surprise: s
        ? { ...s, files_count: fileCountBySurpriseId.get(s.id) ?? 0 }
        : null,
      display_status: s ? s.status : 'empty',
    };
  });
}

export async function getAdminDashboardData(
  clock: BogotaClockSnapshot
): Promise<{ stats: AdminDashboardStats; days: AdminDaySummary[] }> {
  const days = await listAllAdminCalendarDays();
  let createdCount = 0;
  let publishedCount = 0;
  let scheduledCount = 0;
  let draftCount = 0;

  let nextPublication: AdminDashboardStats['nextPublication'] = null;

  for (const item of days) {
    if (item.surprise) {
      createdCount++;
      if (item.surprise.status === 'published') publishedCount++;
      else if (item.surprise.status === 'scheduled') scheduledCount++;
      else draftCount++;

      if (
        (item.surprise.status === 'scheduled' ||
          item.surprise.status === 'published') &&
        Date.parse(item.unlock_at) >= clock.serverTimestampMs
      ) {
        if (
          !nextPublication ||
          Date.parse(item.unlock_at) < Date.parse(nextPublication.unlock_at)
        ) {
          nextPublication = {
            day_number: item.day_number,
            title: item.surprise.title,
            unlock_at: item.unlock_at,
          };
        }
      }
    }
  }

  return {
    stats: {
      totalDays: 31,
      createdCount,
      publishedCount,
      scheduledCount,
      draftCount,
      pendingCount: Math.max(0, 31 - createdCount),
      nextPublication,
    },
    days,
  };
}

export async function getAdminDayDetail(dayNumber: number): Promise<AdminDayDetail | null> {
  const dayRows = await supabaseRest<CalendarDayRow[]>(
    `calendar_days?day_number=eq.${dayNumber}&select=*`
  );
  const day = dayRows?.[0];
  if (!day) return null;

  const surpriseRows = await supabaseRest<SurpriseRow[]>(
    `surprises?calendar_day_id=eq.${encodeURIComponent(day.id)}&select=*`
  );
  const surprise = surpriseRows?.[0] ?? null;

  let files: SurpriseFileWithUrl[] = [];
  if (surprise) {
    const rawFiles = await supabaseRest<SurpriseFileRow[]>(
      `surprise_files?surprise_id=eq.${encodeURIComponent(surprise.id)}&select=*&order=display_order.asc,created_at.asc`
    );
    files = await Promise.all(
      (rawFiles || []).map(async (f) => ({
        ...f,
        signed_url: await createSignedStorageUrl(f.bucket_name, f.storage_path, 900),
      }))
    );
  }

  return { day, surprise, files };
}

export async function upsertAdminDaySurprise(input: {
  dayNumber: number;
  unlockAt?: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  contentType: AdminContentType;
  contentData: Record<string, unknown>;
  status: SurpriseStatus;
}): Promise<AdminDayDetail> {
  const dayRows = await supabaseRest<CalendarDayRow[]>(
    `calendar_days?day_number=eq.${input.dayNumber}&select=*`
  );
  let day = dayRows?.[0];

  if (!day) {
    const createdDays = await supabaseRest<CalendarDayRow[]>('calendar_days', {
      method: 'POST',
      prefer: 'return=representation',
      body: {
        day_number: input.dayNumber,
        unlock_at:
          input.unlockAt ||
          `2026-12-${String(input.dayNumber).padStart(2, '0')}T00:00:00-05:00`,
      },
    });
    day = createdDays[0];
  } else if (input.unlockAt && input.unlockAt !== day.unlock_at) {
    const updatedDays = await supabaseRest<CalendarDayRow[]>(
      `calendar_days?id=eq.${encodeURIComponent(day.id)}`,
      {
        method: 'PATCH',
        prefer: 'return=representation',
        body: { unlock_at: input.unlockAt },
      }
    );
    if (updatedDays?.[0]) day = updatedDays[0];
  }

  const existing = await supabaseRest<SurpriseRow[]>(
    `surprises?calendar_day_id=eq.${encodeURIComponent(day.id)}&select=*`
  );

  const surprisePayload = {
    calendar_day_id: day.id,
    title: input.title.trim(),
    subtitle: input.subtitle?.trim() || null,
    description: input.description?.trim() || null,
    content_type: input.contentType,
    content_data: input.contentData ?? {},
    status: input.status,
  };

  if (existing?.[0]) {
    await supabaseRest<SurpriseRow[]>(
      `surprises?id=eq.${encodeURIComponent(existing[0].id)}`,
      {
        method: 'PATCH',
        prefer: 'return=representation',
        body: surprisePayload,
      }
    );
  } else {
    await supabaseRest<SurpriseRow[]>('surprises', {
      method: 'POST',
      prefer: 'return=representation',
      body: surprisePayload,
    });
  }

  const detail = await getAdminDayDetail(input.dayNumber);
  if (!detail) {
    throw new Error('No se pudo cargar la sorpresa después de guardarla.');
  }
  return detail;
}

export async function deleteAdminDaySurprise(dayNumber: number): Promise<void> {
  const detail = await getAdminDayDetail(dayNumber);
  if (!detail?.surprise) return;

  for (const file of detail.files) {
    await deleteObjectFromSupabaseStorage(file.bucket_name, file.storage_path);
  }

  await supabaseRest<unknown>(
    `surprises?id=eq.${encodeURIComponent(detail.surprise.id)}`,
    { method: 'DELETE' }
  );
}

export async function registerUploadedSurpriseFile(input: {
  dayNumber: number;
  bucket: StorageBucketName;
  storagePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  mediaRole: MediaRole;
}): Promise<SurpriseFileWithUrl> {
  let detail = await getAdminDayDetail(input.dayNumber);
  if (!detail?.surprise) {
    // Si aún no existe borrador para ese día, creamos un borrador base para asociar el archivo
    detail = await upsertAdminDaySurprise({
      dayNumber: input.dayNumber,
      title: `Borrador del Día ${input.dayNumber}`,
      contentType: input.bucket === 'surprise-documents' ? 'letter' : 'gallery',
      contentData: {},
      status: 'draft',
    });
  }

  const nextOrder = detail.files.length;
  const inserted = await supabaseRest<SurpriseFileRow[]>('surprise_files', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      surprise_id: detail.surprise!.id,
      bucket_name: input.bucket,
      storage_path: input.storagePath,
      file_name: input.fileName,
      file_type: input.fileType,
      file_size: input.fileSize,
      media_role: input.mediaRole,
      display_order: nextOrder,
    },
  });

  const row = inserted[0];
  return {
    ...row,
    signed_url: await createSignedStorageUrl(row.bucket_name, row.storage_path, 900),
  };
}

export async function listAllAdminMediaFiles(): Promise<SurpriseFileWithUrl[]> {
  const [days, surprises, files] = await Promise.all([
    supabaseRest<CalendarDayRow[]>('calendar_days?select=*'),
    supabaseRest<SurpriseRow[]>('surprises?select=*'),
    supabaseRest<SurpriseFileRow[]>('surprise_files?select=*&order=created_at.desc'),
  ]);

  const dayById = new Map((days || []).map((d) => [d.id, d]));
  const surpriseById = new Map((surprises || []).map((s) => [s.id, s]));

  return Promise.all(
    (files || []).map(async (f) => {
      const surprise = surpriseById.get(f.surprise_id);
      const day = surprise ? dayById.get(surprise.calendar_day_id) : undefined;
      return {
        ...f,
        day_number: day?.day_number,
        surprise_title: surprise?.title,
        signed_url: await createSignedStorageUrl(f.bucket_name, f.storage_path, 900),
      };
    })
  );
}

export async function deleteAdminFileById(fileId: string): Promise<boolean> {
  const rows = await supabaseRest<SurpriseFileRow[]>(
    `surprise_files?id=eq.${encodeURIComponent(fileId)}&select=*`
  );
  const file = rows?.[0];
  if (!file) return false;

  await deleteObjectFromSupabaseStorage(file.bucket_name, file.storage_path);
  await supabaseRest<unknown>(
    `surprise_files?id=eq.${encodeURIComponent(fileId)}`,
    { method: 'DELETE' }
  );
  return true;
}

/**
 * Entrega segura para la experiencia pública de María:
 * Solo devuelve contenido si la sorpresa está `published` o `scheduled` Y
 * la fecha `unlock_at` ya se cumplió según el reloj oficial del servidor en America/Bogota.
 * Genera URLs firmadas temporales (10 minutos) únicamente para ese día desbloqueado.
 */
export async function getPublicUnlockedDayFromSupabase(
  dayNumber: number,
  clock: BogotaClockSnapshot
): Promise<UnlockedDayDetailDTO | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const dayRows = await supabaseRest<CalendarDayRow[]>(
      `calendar_days?day_number=eq.${dayNumber}&select=*`
    );
    const day = dayRows?.[0];
    if (!day) return null;

    // Verificación independiente de desbloqueo en el servidor (America/Bogota)
    const unlockMs = Date.parse(day.unlock_at);
    if (!Number.isNaN(unlockMs) && unlockMs > clock.serverTimestampMs) {
      return null;
    }

    const surpriseRows = await supabaseRest<SurpriseRow[]>(
      `surprises?calendar_day_id=eq.${encodeURIComponent(day.id)}&status=in.(scheduled,published)&select=*`
    );
    const surprise = surpriseRows?.[0];
    if (!surprise) return null;

    const rawFiles = await supabaseRest<SurpriseFileRow[]>(
      `surprise_files?surprise_id=eq.${encodeURIComponent(surprise.id)}&select=*&order=display_order.asc,created_at.asc`
    );

    const mediaUrls = (
      await Promise.all(
        (rawFiles || []).map(async (f) => {
          const signed = await createSignedStorageUrl(
            f.bucket_name,
            f.storage_path,
            600
          );
          if (!signed) return null;
          const kind: 'image' | 'video' | 'audio' | 'pdf' =
            f.file_type.startsWith('image/')
              ? 'image'
              : f.file_type.startsWith('video/')
                ? 'video'
                : f.file_type.startsWith('audio/')
                  ? 'audio'
                  : 'pdf';
          return {
            id: f.id,
            kind,
            url: signed,
            caption: f.file_name,
            mimeType: f.file_type,
            mediaRole: f.media_role,
          };
        })
      )
    ).filter((item): item is NonNullable<typeof item> => item !== null);

    const data = surprise.content_data || {};
    const letterText = typeof data.letterBody === 'string' ? data.letterBody : '';
    const bodyParagraphs = letterText
      ? letterText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
      : surprise.description
        ? surprise.description.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
        : [];

    const mappedType =
      surprise.content_type === 'special' ? 'mixed' : surprise.content_type;

    return {
      day: dayNumber,
      dateLabel: `${dayNumber} de diciembre de 2026`,
      state: clock.calendarPhase === 'december_active' && clock.day === dayNumber ? 'today' : 'unlocked',
      specialMilestone: dayNumber === 25 ? 'christmas' : dayNumber === 31 ? 'finale' : null,
      isConfigured: true,
      contentType: mappedType,
      title: surprise.title,
      subtitle: surprise.subtitle ?? undefined,
      bodyParagraphs,
      signature: typeof data.signature === 'string' ? data.signature : undefined,
      contentData: data,
      mediaUrls,
    } as UnlockedDayDetailDTO;
  } catch {
    return null;
  }
}
