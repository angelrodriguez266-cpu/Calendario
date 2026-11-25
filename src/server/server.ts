import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CALENDAR_DAYS_2026, getDayDefinition } from '../data/calendarDays.ts';
import { renderAdminHtmlShell } from './adminHtmlShell.ts';
import { handleAdminApiRequest } from './adminRoutes.ts';
import { getAuthenticatedAdmin } from './adminSession.ts';
import { getBogotaClockSnapshot, getDayUnlockState } from './bogotaTime.ts';
import { renderHtmlShell } from './htmlShell.ts';
import {
  checkRateLimit,
  clearFailedAttempts,
  isServerAuthConfigured,
  recordFailedAttempt,
  verifyAccessPassword,
} from './passwordAuth.ts';
import {
  buildSessionCookieHeader,
  createSignedSessionToken,
  isRequestAuthenticated,
} from './sessionToken.ts';
import {
  getPublicUnlockedDayFromSupabase,
  getSupabaseStatusSummary,
  isSupabaseConfigured,
  verifyAdminAuthorizationInDb,
} from './supabaseClient.ts';
import type {
  CalendarOverviewResponse,
  PublicDayCardDTO,
  UnlockedDayDetailDTO,
} from '../types/calendar.ts';

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const PRIVATE_CONTENT_DIR = path.resolve(process.cwd(), 'private-content');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function setCommonSecurityHeaders(res: ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  data: unknown,
  extraHeaders?: Record<string, string>
): void {
  setCommonSecurityHeaders(res);
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
  return req.socket.remoteAddress ?? 'local-client';
}

async function readJsonBody(req: IncomingMessage, maxBytes = 4096): Promise<unknown> {
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

function buildCalendarOverview(): CalendarOverviewResponse {
  const clock = getBogotaClockSnapshot();
  const days: PublicDayCardDTO[] = CALENDAR_DAYS_2026.map((entry) => ({
    day: entry.day,
    dateLabel: entry.dateLabel,
    state: getDayUnlockState(entry.day, clock),
    cardIcon: entry.cardIcon,
    specialMilestone: entry.specialMilestone,
    isConfigured: entry.isConfigured,
  }));

  return { clock, days };
}

// ============================================================================
// CLIENTES SSE AUTENTICADOS PARA DESBLOQUEO AUTOMÁTICO A LAS 00:00 (BOGOTÁ)
// ============================================================================
const sseClients = new Set<ServerResponse>();
let midnightBroadcastTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleNextBogotaMidnightBroadcast(): void {
  if (midnightBroadcastTimer) {
    clearTimeout(midnightBroadcastTimer);
  }
  const clock = getBogotaClockSnapshot();
  const delayMs = Math.min(clock.msUntilNextMidnight + 250, 60 * 60 * 1000);

  midnightBroadcastTimer = setTimeout(() => {
    if (sseClients.size > 0) {
      const payload = JSON.stringify(buildCalendarOverview());
      for (const client of sseClients) {
        try {
          client.write(`event: calendar-sync\ndata: ${payload}\n\n`);
        } catch {
          sseClients.delete(client);
        }
      }
    }
    scheduleNextBogotaMidnightBroadcast();
  }, delayMs);
}

scheduleNextBogotaMidnightBroadcast();

async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string
): Promise<void> {
  // 1. POST /api/auth/login
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    if (!isServerAuthConfigured()) {
      sendJson(res, 503, {
        authenticated: false,
        code: 'SERVER_NOT_CONFIGURED',
        message:
          'El acceso privado está protegido en el servidor y aún requiere configurar CALENDAR_PASSWORD_HASH y SESSION_SECRET en .env.local.',
      });
      return;
    }

    const clientIp = resolveClientIp(req);
    const rate = checkRateLimit(clientIp);
    if (!rate.allowed) {
      sendJson(
        res,
        429,
        {
          authenticated: false,
          code: 'RATE_LIMITED',
          message:
            'Demasiados intentos seguidos. Espera unos minutos antes de volver a intentarlo.',
          retryAfterSeconds: rate.retryAfterSeconds,
        },
        { 'Retry-After': String(rate.retryAfterSeconds) }
      );
      return;
    }

    let body: { password?: unknown };
    try {
      body = (await readJsonBody(req)) as { password?: unknown };
    } catch {
      sendJson(res, 400, {
        authenticated: false,
        code: 'BAD_REQUEST',
        message: 'Solicitud inválida.',
      });
      return;
    }

    const candidate = typeof body.password === 'string' ? body.password : '';
    if (!candidate || candidate.length > 256) {
      recordFailedAttempt(clientIp);
      sendJson(res, 401, {
        authenticated: false,
        code: 'INVALID_PASSWORD',
        message:
          'Esa clave no coincide con nuestro secreto. Inténtalo nuevamente con calma.',
      });
      return;
    }

    const isValid = verifyAccessPassword(candidate);
    if (!isValid) {
      recordFailedAttempt(clientIp);
      sendJson(res, 401, {
        authenticated: false,
        code: 'INVALID_PASSWORD',
        message:
          'Esa clave no coincide con nuestro secreto. Inténtalo nuevamente con calma.',
      });
      return;
    }

    clearFailedAttempts(clientIp);
    const sessionToken = createSignedSessionToken();
    if (!sessionToken) {
      sendJson(res, 503, {
        authenticated: false,
        code: 'SERVER_NOT_CONFIGURED',
        message: 'Falta configurar SESSION_SECRET en el servidor.',
      });
      return;
    }

    const cookieHeader = buildSessionCookieHeader(sessionToken, req, false);
    sendJson(
      res,
      200,
      { authenticated: true },
      { 'Set-Cookie': cookieHeader }
    );
    return;
  }

  // 2. POST /api/auth/logout
  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const clearHeader = buildSessionCookieHeader('', req, true);
    sendJson(
      res,
      200,
      { authenticated: false },
      { 'Set-Cookie': clearHeader }
    );
    return;
  }

  // 3. GET /api/auth/session
  if (pathname === '/api/auth/session' && req.method === 'GET') {
    const configured = isServerAuthConfigured();
    const authenticated = configured ? isRequestAuthenticated(req) : false;
    sendJson(res, 200, { authenticated, configured });
    return;
  }

  // Todas las rutas /api/calendar/* exigen sesión HttpOnly válida
  if (pathname.startsWith('/api/calendar')) {
    if (!isServerAuthConfigured() || !isRequestAuthenticated(req)) {
      sendJson(res, 401, {
        error: 'No autorizado. Ingresa la clave privada para acceder al calendario.',
      });
      return;
    }

    // 4. GET /api/calendar
    if (pathname === '/api/calendar' && req.method === 'GET') {
      sendJson(res, 200, buildCalendarOverview());
      return;
    }

    // 5. GET /api/calendar/stream (SSE para desbloqueo automático en vivo)
    if (pathname === '/api/calendar/stream' && req.method === 'GET') {
      setCommonSecurityHeaders(res);
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'private, no-cache, no-transform',
        Connection: 'keep-alive',
      });
      res.write(`event: calendar-sync\ndata: ${JSON.stringify(buildCalendarOverview())}\n\n`);
      sseClients.add(res);

      const keepAlive = setInterval(() => {
        try {
          res.write(': heartbeat\n\n');
        } catch {
          clearInterval(keepAlive);
          sseClients.delete(res);
        }
      }, 25_000);

      req.on('close', () => {
        clearInterval(keepAlive);
        sseClients.delete(res);
      });
      return;
    }

    // 6. GET /api/calendar/:day
    const dayMatch = pathname.match(/^\/api\/calendar\/(\d{1,2})$/);
    if (dayMatch && req.method === 'GET') {
      const dayNumber = Number(dayMatch[1]);
      const definition = getDayDefinition(dayNumber);
      if (!definition) {
        sendJson(res, 404, { error: 'Día fuera del rango del calendario (1–31).' });
        return;
      }

      const clock = getBogotaClockSnapshot();
      const state = getDayUnlockState(dayNumber, clock);
      if (state === 'locked') {
        sendJson(res, 403, {
          code: 'DAY_LOCKED',
          error: `El día ${dayNumber} de diciembre permanece bloqueado hasta las 00:00 (hora de Colombia).`,
        });
        return;
      }

      // Si Supabase está configurado, entregar la sorpresa publicada/programada
      // verificada en el servidor con URLs firmadas temporales
      if (isSupabaseConfigured()) {
        const supabaseDetail = await getPublicUnlockedDayFromSupabase(dayNumber, clock);
        if (supabaseDetail) {
          sendJson(res, 200, supabaseDetail);
          return;
        }
      }

      const detail: UnlockedDayDetailDTO = {
        day: definition.day,
        dateLabel: definition.dateLabel,
        state,
        specialMilestone: definition.specialMilestone,
        isConfigured: definition.isConfigured,
        contentType: definition.contentType,
        title: definition.title,
        subtitle: definition.subtitle,
        bodyParagraphs: definition.bodyParagraphs,
        signature: definition.signature,
        mediaUrls: definition.mediaAssets?.map((asset) => ({
          id: asset.id,
          kind: asset.kind,
          url: `/api/calendar/${definition.day}/asset/${encodeURIComponent(asset.filename)}`,
          caption: asset.caption,
          mimeType: asset.mimeType,
        })),
      };

      sendJson(res, 200, detail);
      return;
    }

    // 7. GET /api/calendar/:day/asset/:filename
    const assetMatch = pathname.match(/^\/api\/calendar\/(\d{1,2})\/asset\/([^/]+)$/);
    if (assetMatch && req.method === 'GET') {
      const dayNumber = Number(assetMatch[1]);
      const rawFilename = decodeURIComponent(assetMatch[2]);
      const definition = getDayDefinition(dayNumber);

      if (!definition) {
        sendJson(res, 404, { error: 'Día inválido.' });
        return;
      }

      const state = getDayUnlockState(dayNumber, getBogotaClockSnapshot());
      if (state === 'locked') {
        sendJson(res, 403, { error: 'Recurso aún bloqueado por fecha.' });
        return;
      }

      const safeFilename = path.basename(rawFilename);
      const declaredAsset = definition.mediaAssets?.find(
        (item) => item.filename === safeFilename
      );
      if (!declaredAsset) {
        sendJson(res, 404, { error: 'Recurso no registrado para este día.' });
        return;
      }

      const paddedDay = String(dayNumber).padStart(2, '0');
      const assetPath = path.resolve(
        PRIVATE_CONTENT_DIR,
        `day-${paddedDay}`,
        safeFilename
      );

      if (!assetPath.startsWith(PRIVATE_CONTENT_DIR + path.sep)) {
        sendJson(res, 403, { error: 'Ruta no permitida.' });
        return;
      }

      try {
        const buffer = await fs.readFile(assetPath);
        setCommonSecurityHeaders(res);
        res.writeHead(200, {
          'Content-Type': declaredAsset.mimeType,
          'Cache-Control': 'private, no-store',
        });
        res.end(buffer);
      } catch {
        sendJson(res, 404, { error: 'Archivo privado aún no disponible.' });
      }
      return;
    }
  }

  sendJson(res, 404, { error: 'Ruta API no encontrada.' });
}

async function serveStaticPublicFile(
  res: ServerResponse,
  pathname: string
): Promise<boolean> {
  const relativePath = pathname.replace(/^\/+/, '');
  const resolvedPath = path.resolve(PUBLIC_DIR, relativePath);

  if (!resolvedPath.startsWith(PUBLIC_DIR + path.sep)) {
    return false;
  }

  try {
    const stat = await fs.stat(resolvedPath);
    if (!stat.isFile()) return false;

    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
    const content = await fs.readFile(resolvedPath);

    setCommonSecurityHeaders(res);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

export async function handleAppRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const host = req.headers.host ?? `localhost:${PORT}`;
    const parsedUrl = new URL(req.url ?? '/', `http://${host}`);
    const { pathname, searchParams } = parsedUrl;

    if (pathname.startsWith('/api/admin')) {
      await handleAdminApiRequest(req, res, pathname);
      return;
    }

    if (pathname.startsWith('/api/')) {
      await handleApiRequest(req, res, pathname);
      return;
    }

    // Ruta independiente y protegida del Panel de Administración (/admin)
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      const sessionUser = getAuthenticatedAdmin(req);
      const isAuthorized =
        sessionUser && isSupabaseConfigured()
          ? await verifyAdminAuthorizationInDb(sessionUser.uid, sessionUser.email)
          : false;

      const html = renderAdminHtmlShell({
        authenticated: Boolean(isAuthorized),
        user: isAuthorized ? sessionUser : null,
        supabaseStatus: getSupabaseStatusSummary(),
        bogotaDateLabel: getBogotaClockSnapshot().formattedDateEs,
      });

      setCommonSecurityHeaders(res);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      });
      res.end(html);
      return;
    }

    // Protección estricta en el servidor contra acceso por URL directa al calendario
    if (pathname === '/calendario' || pathname.startsWith('/calendario/')) {
      const configured = isServerAuthConfigured();
      const authenticated = configured ? isRequestAuthenticated(req) : false;

      if (!authenticated) {
        setCommonSecurityHeaders(res);
        res.writeHead(302, {
          Location: '/?acceso=privado',
          'Cache-Control': 'private, no-store',
        });
        res.end();
        return;
      }

      const html = renderHtmlShell({
        initialAuthenticated: true,
        initialServerConfigured: configured,
        initialStage: 'calendar',
      });
      setCommonSecurityHeaders(res);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      });
      res.end(html);
      return;
    }

    // Portada / Acceso privado en la ruta raíz
    if (pathname === '/') {
      const configured = isServerAuthConfigured();
      const authenticated = configured ? isRequestAuthenticated(req) : false;
      const requestedAccess = searchParams.has('acceso');

      const html = renderHtmlShell({
        initialAuthenticated: authenticated,
        initialServerConfigured: configured,
        initialStage: requestedAccess ? 'access' : 'hero',
      });
      setCommonSecurityHeaders(res);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      });
      res.end(html);
      return;
    }

    // Archivos estáticos de la interfaz (public/)
    const served = await serveStaticPublicFile(res, pathname);
    if (served) return;

    // Cualquier otra URL no existente redirige limpiamente al inicio
    setCommonSecurityHeaders(res);
    res.writeHead(302, { Location: '/' });
    res.end();
  } catch (error) {
    console.error('Error inesperado en el servidor:', error);
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'Error interno del servidor.' });
    }
  }
}

export const server = http.createServer(handleAppRequest);

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  await handleAppRequest(req, res);
}
