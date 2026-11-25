import crypto from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { parseCookies } from './sessionToken.ts';
import type { AdminSessionUser } from '../types/admin.ts';

export const ADMIN_COOKIE_NAME = 'ma_admin_session';
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 horas

interface AdminTokenPayload {
  sub: 'admin';
  uid: string;
  email: string;
  iat: number;
  exp: number;
}

interface AdminRateEntry {
  failures: number;
  windowStartMs: number;
  blockedUntilMs: number;
}

const adminRateMap = new Map<string, AdminRateEntry>();
const ADMIN_MAX_ATTEMPTS = 5;
const ADMIN_WINDOW_MS = 10 * 60 * 1000;
const ADMIN_BLOCK_MS = 10 * 60 * 1000;

function getAdminSigningSecret(): string | null {
  const dedicated = process.env.ADMIN_SESSION_SECRET?.trim();
  if (dedicated && dedicated.length >= 24) return dedicated;

  const fallback = process.env.SESSION_SECRET?.trim();
  if (fallback && fallback.length >= 24) {
    return crypto.createHash('sha256').update(`admin:${fallback}`).digest('hex');
  }
  return null;
}

export function checkAdminRateLimit(clientKey: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const entry = adminRateMap.get(clientKey);
  if (!entry) return { allowed: true, retryAfterSeconds: 0 };
  if (entry.blockedUntilMs > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((entry.blockedUntilMs - now) / 1000),
    };
  }
  if (now - entry.windowStartMs > ADMIN_WINDOW_MS) {
    adminRateMap.delete(clientKey);
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordAdminFailedLogin(clientKey: string): void {
  const now = Date.now();
  const current = adminRateMap.get(clientKey);
  if (!current || now - current.windowStartMs > ADMIN_WINDOW_MS) {
    adminRateMap.set(clientKey, {
      failures: 1,
      windowStartMs: now,
      blockedUntilMs: 0,
    });
    return;
  }
  const failures = current.failures + 1;
  adminRateMap.set(clientKey, {
    failures,
    windowStartMs: current.windowStartMs,
    blockedUntilMs: failures >= ADMIN_MAX_ATTEMPTS ? now + ADMIN_BLOCK_MS : 0,
  });
}

export function clearAdminFailedLogins(clientKey: string): void {
  adminRateMap.delete(clientKey);
}

export function createAdminSessionToken(user: AdminSessionUser): string | null {
  const secret = getAdminSigningSecret();
  if (!secret) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const payload: AdminTokenPayload = {
    sub: 'admin',
    uid: user.uid,
    email: user.email,
    iat: nowSec,
    exp: nowSec + ADMIN_SESSION_TTL_SECONDS,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sigB64 = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${sigB64}`;
}

export function verifyAdminSessionToken(
  token: string | undefined | null
): AdminSessionUser | null {
  if (!token) return null;
  const secret = getAdminSigningSecret();
  if (!secret) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest();

  let providedSig: Buffer;
  try {
    providedSig = Buffer.from(sigB64, 'base64url');
  } catch {
    return null;
  }

  if (
    providedSig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(providedSig, expectedSig)
  ) {
    return null;
  }

  try {
    const raw = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const decoded = JSON.parse(raw) as Partial<AdminTokenPayload>;
    if (
      decoded.sub !== 'admin' ||
      typeof decoded.uid !== 'string' ||
      typeof decoded.email !== 'string' ||
      typeof decoded.exp !== 'number'
    ) {
      return null;
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (decoded.exp <= nowSec) return null;

    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

export function getAuthenticatedAdmin(req: IncomingMessage): AdminSessionUser | null {
  const cookies = parseCookies(req);
  return verifyAdminSessionToken(cookies[ADMIN_COOKIE_NAME]);
}

export function buildAdminCookieHeader(
  token: string,
  req: IncomingMessage,
  clear = false
): string {
  const protoHeader = req.headers['x-forwarded-proto'];
  const isHttps =
    process.env.NODE_ENV === 'production' ||
    protoHeader === 'https' ||
    Boolean((req.socket as { encrypted?: boolean }).encrypted);

  const maxAge = clear ? 0 : ADMIN_SESSION_TTL_SECONDS;
  const segments = [
    `${ADMIN_COOKIE_NAME}=${clear ? '' : encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
  ];
  if (isHttps) {
    segments.push('Secure');
  }
  return segments.join('; ');
}
