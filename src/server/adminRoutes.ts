import type { IncomingMessage, ServerResponse } from 'node:http';
import { getBogotaClockSnapshot } from './bogotaTime.ts';
import {
  buildAdminCookieHeader,
  checkAdminRateLimit,
  clearAdminFailedLogins,
  createAdminSessionToken,
  getAuthenticatedAdmin,
  recordAdminFailedLogin,
} from './adminSession.ts';
import {
  buildStorageObjectPath,
  FILE_RULES,
  sanitizeMediaRole,
  validateUploadedFile,
} from './fileValidation.ts';
import {
  authenticateAdminWithSupabase,
  deleteAdminDaySurprise,
  deleteAdminFileById,
  getAdminDashboardData,
  getAdminDayDetail,
  getSupabaseStatusSummary,
  isSupabaseConfigured,
  listAllAdminCalendarDays,
  listAllAdminMediaFiles,
  registerUploadedSurpriseFile,
  uploadBufferToSupabaseStorage,
  upsertAdminDaySurprise,
  verifyAdminAuthorizationInDb,
} from './supabaseClient.ts';
import type { AdminContentType, SurpriseStatus } from '../types/admin.ts';

const VALID_CONTENT_TYPES: Set<AdminContentType> = new Set([
  'letter',
  'video',
  'audio',
  'gallery',
  'coupon',
  'special',
]);

const VALID_STATUSES: Set<SurpriseStatus> = new Set([
  'draft',
  'scheduled',
  'published',
]);

function sendJson(
  res: ServerResponse,
  statusCode: number,
  data: unknown,
  extraHeaders?: Record<string, string>
): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'private, no-store, no-cache, must-revalidate',
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

function resolveClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'local-admin';
}

async function readJsonBody(req: IncomingMessage, maxBytes = 256_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function readBinaryBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('FILE_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export async function handleAdminApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string
): Promise<void> {
  // 1. POST /api/admin/auth/login
  if (pathname === '/api/admin/auth/login' && req.method === 'POST') {
    const clientIp = resolveClientIp(req);
    const rate = checkAdminRateLimit(clientIp);
    if (!rate.allowed) {
      sendJson(
        res,
        429,
        {
          authenticated: false,
          code: 'RATE_LIMITED',
          message:
            'Demasiados intentos de acceso. Espera unos minutos antes de volver a intentarlo.',
        },
        { 'Retry-After': String(rate.retryAfterSeconds) }
      );
      return;
    }

    let body: { email?: unknown; password?: unknown };
    try {
      body = (await readJsonBody(req, 8192)) as {
        email?: unknown;
        password?: unknown;
      };
    } catch {
      sendJson(res, 400, {
        authenticated: false,
        message: 'Solicitud inválida.',
      });
      return;
    }

    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      sendJson(res, 400, {
        authenticated: false,
        message: 'Ingresa tu correo electrónico y contraseña.',
      });
      return;
    }

    const authResult = await authenticateAdminWithSupabase(email, password);
    if (!authResult.ok) {
      if (authResult.status === 401 || authResult.status === 403) {
        recordAdminFailedLogin(clientIp);
      }
      sendJson(res, authResult.status, {
        authenticated: false,
        code: authResult.code,
        message: authResult.message,
      });
      return;
    }

    clearAdminFailedLogins(clientIp);
    const sessionToken = createAdminSessionToken({
      uid: authResult.uid,
      email: authResult.email,
    });

    if (!sessionToken) {
      sendJson(res, 503, {
        authenticated: false,
        message: 'Falta configurar SESSION_SECRET o ADMIN_SESSION_SECRET en el servidor.',
      });
      return;
    }

    const cookieHeader = buildAdminCookieHeader(sessionToken, req, false);
    sendJson(
      res,
      200,
      {
        authenticated: true,
        user: { uid: authResult.uid, email: authResult.email },
      },
      { 'Set-Cookie': cookieHeader }
    );
    return;
  }

  // 2. POST /api/admin/auth/logout
  if (pathname === '/api/admin/auth/logout' && req.method === 'POST') {
    const clearCookie = buildAdminCookieHeader('', req, true);
    sendJson(
      res,
      200,
      { authenticated: false },
      { 'Set-Cookie': clearCookie }
    );
    return;
  }

  // 3. GET /api/admin/auth/session
  if (pathname === '/api/admin/auth/session' && req.method === 'GET') {
    const sessionUser = getAuthenticatedAdmin(req);
    const authorized =
      sessionUser && isSupabaseConfigured()
        ? await verifyAdminAuthorizationInDb(sessionUser.uid, sessionUser.email)
        : false;

    sendJson(res, 200, {
      authenticated: Boolean(authorized),
      user: authorized ? sessionUser : null,
      supabaseStatus: getSupabaseStatusSummary(),
      bogotaNow: getBogotaClockSnapshot(),
    });
    return;
  }

  // =========================================================================
  // TODAS LAS RUTAS SIGUIENTES EXIGEN SESIÓN DE ADMINISTRADOR AUTORIZADO
  // =========================================================================
  const adminUser = getAuthenticatedAdmin(req);
  if (!adminUser) {
    sendJson(res, 401, {
      error: 'No autorizado. Inicia sesión como administrador.',
    });
    return;
  }

  if (!isSupabaseConfigured()) {
    sendJson(res, 503, {
      error: 'Supabase no está configurado en el servidor.',
    });
    return;
  }

  const stillAuthorized = await verifyAdminAuthorizationInDb(
    adminUser.uid,
    adminUser.email
  );
  if (!stillAuthorized) {
    const clearCookie = buildAdminCookieHeader('', req, true);
    sendJson(
      res,
      403,
      { error: 'Permisos de administrador revocados o no autorizados.' },
      { 'Set-Cookie': clearCookie }
    );
    return;
  }

  try {
    // 4. GET /api/admin/dashboard
    if (pathname === '/api/admin/dashboard' && req.method === 'GET') {
      const clock = getBogotaClockSnapshot();
      const dashboard = await getAdminDashboardData(clock);
      sendJson(res, 200, {
        ...dashboard,
        clock,
        user: adminUser,
      });
      return;
    }

    // 5. GET /api/admin/calendar
    if (pathname === '/api/admin/calendar' && req.method === 'GET') {
      const days = await listAllAdminCalendarDays();
      sendJson(res, 200, { days, clock: getBogotaClockSnapshot() });
      return;
    }

    // 6. GET / PUT / DELETE /api/admin/surprises/:day
    const dayMatch = pathname.match(/^\/api\/admin\/surprises\/(\d{1,2})$/);
    if (dayMatch) {
      const dayNumber = Number(dayMatch[1]);
      if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 31) {
        sendJson(res, 400, { error: 'Número de día inválido (debe estar entre 1 y 31).' });
        return;
      }

      if (req.method === 'GET') {
        const detail = await getAdminDayDetail(dayNumber);
        if (!detail) {
          sendJson(res, 404, { error: `No se encontró el día ${dayNumber} en calendar_days.` });
          return;
        }
        sendJson(res, 200, detail);
        return;
      }

      if (req.method === 'PUT') {
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        const title = typeof body.title === 'string' ? body.title.trim() : '';
        const contentType = body.content_type as AdminContentType;
        const status = (body.status as SurpriseStatus) || 'draft';

        if (!title) {
          sendJson(res, 400, { error: 'El título de la sorpresa es obligatorio.' });
          return;
        }
        if (!VALID_CONTENT_TYPES.has(contentType)) {
          sendJson(res, 400, { error: 'Tipo de contenido no válido.' });
          return;
        }
        if (!VALID_STATUSES.has(status)) {
          sendJson(res, 400, { error: 'Estado de publicación no válido.' });
          return;
        }

        const unlockAt =
          typeof body.unlock_at === 'string' && !Number.isNaN(Date.parse(body.unlock_at))
            ? body.unlock_at
            : undefined;

        const saved = await upsertAdminDaySurprise({
          dayNumber,
          unlockAt,
          title,
          subtitle: typeof body.subtitle === 'string' ? body.subtitle : null,
          description: typeof body.description === 'string' ? body.description : null,
          contentType,
          contentData:
            body.content_data && typeof body.content_data === 'object'
              ? (body.content_data as Record<string, unknown>)
              : {},
          status,
        });

        sendJson(res, 200, saved);
        return;
      }

      if (req.method === 'DELETE') {
        await deleteAdminDaySurprise(dayNumber);
        sendJson(res, 200, { deleted: true, day_number: dayNumber });
        return;
      }
    }

    // 7. GET /api/admin/files
    if (pathname === '/api/admin/files' && req.method === 'GET') {
      const files = await listAllAdminMediaFiles();
      sendJson(res, 200, { files });
      return;
    }

    // 8. POST /api/admin/files/upload
    if (pathname === '/api/admin/files/upload' && req.method === 'POST') {
      const rawDay = Number(req.headers['x-day-number']);
      if (!Number.isInteger(rawDay) || rawDay < 1 || rawDay > 31) {
        sendJson(res, 400, { error: 'Día de calendario inválido para adjuntar archivo.' });
        return;
      }

      const rawFileNameHeader = req.headers['x-file-name'];
      const rawFileName =
        typeof rawFileNameHeader === 'string'
          ? decodeURIComponent(rawFileNameHeader)
          : '';
      const mimeType =
        typeof req.headers['content-type'] === 'string'
          ? req.headers['content-type']
          : 'application/octet-stream';
      const declaredLength = Number(req.headers['content-length'] || 0);
      const mediaRole = sanitizeMediaRole(req.headers['x-media-role']);

      const maxAllowedOverall = FILE_RULES.video.maxBytes;
      if (declaredLength > maxAllowedOverall) {
        sendJson(res, 413, {
          error: 'El archivo excede el tamaño máximo permitido de 100 MB.',
        });
        return;
      }

      let fileBuffer: Buffer;
      try {
        fileBuffer = await readBinaryBody(req, maxAllowedOverall);
      } catch {
        sendJson(res, 413, {
          error: 'El archivo excede el tamaño máximo permitido.',
        });
        return;
      }

      const validation = validateUploadedFile({
        fileName: rawFileName,
        mimeType,
        sizeBytes: fileBuffer.byteLength,
      });

      if (!validation.ok) {
        sendJson(res, 400, { error: validation.error });
        return;
      }

      const storagePath = buildStorageObjectPath(rawDay, validation.safeFileName);
      await uploadBufferToSupabaseStorage({
        bucket: validation.bucket,
        storagePath,
        buffer: fileBuffer,
        contentType: mimeType.split(';')[0].trim(),
      });

      const record = await registerUploadedSurpriseFile({
        dayNumber: rawDay,
        bucket: validation.bucket,
        storagePath,
        fileName: rawFileName,
        fileType: mimeType.split(';')[0].trim(),
        fileSize: fileBuffer.byteLength,
        mediaRole,
      });

      sendJson(res, 201, { file: record });
      return;
    }

    // 9. DELETE /api/admin/files/:fileId
    const fileMatch = pathname.match(/^\/api\/admin\/files\/([^/]+)$/);
    if (fileMatch && req.method === 'DELETE') {
      const fileId = decodeURIComponent(fileMatch[1]);
      const deleted = await deleteAdminFileById(fileId);
      if (!deleted) {
        sendJson(res, 404, { error: 'Archivo no encontrado.' });
        return;
      }
      sendJson(res, 200, { deleted: true, id: fileId });
      return;
    }

    sendJson(res, 404, { error: 'Endpoint administrativo no encontrado.' });
  } catch (err) {
    console.error('Error en API de administración:', err);
    sendJson(res, 500, {
      error: 'Ocurrió un error al comunicarse con Supabase. Revisa la configuración y migraciones.',
    });
  }
}
