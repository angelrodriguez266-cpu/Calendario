import crypto from 'node:crypto';
import type { IncomingMessage } from 'node:http';

export const SESSION_COOKIE_NAME = 'ma_private_session';
const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 días

interface SessionPayload {
  sub: 'maria-y-angel';
  iat: number;
  exp: number;
}

export function getSessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 24) {
    return null;
  }
  return secret;
}

export function getSessionMaxAgeSeconds(): number {
  const raw = Number(process.env.SESSION_MAX_AGE_SECONDS);
  if (Number.isFinite(raw) && raw >= 300 && raw <= 60 * 60 * 24 * 60) {
    return Math.floor(raw);
  }
  return DEFAULT_MAX_AGE_SECONDS;
}

export function createSignedSessionToken(): string | null {
  const secret = getSessionSecret();
  if (!secret) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: 'maria-y-angel',
    iat: nowSec,
    exp: nowSec + getSessionMaxAgeSeconds(),
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url'
  );
  const sigB64 = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${sigB64}`;
}

export function verifySignedSessionToken(
  token: string | undefined | null
): boolean {
  if (!token) return false;
  const secret = getSessionSecret();
  if (!secret) return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return false;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest();

  let providedSig: Buffer;
  try {
    providedSig = Buffer.from(sigB64, 'base64url');
  } catch {
    return false;
  }

  if (providedSig.length !== expectedSig.length) {
    return false;
  }

  if (!crypto.timingSafeEqual(providedSig, expectedSig)) {
    return false;
  }

  try {
    const rawJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const decoded = JSON.parse(rawJson) as Partial<SessionPayload>;
    if (decoded.sub !== 'maria-y-angel' || typeof decoded.exp !== 'number') {
      return false;
    }
    const nowSec = Math.floor(Date.now() / 1000);
    return decoded.exp > nowSec;
  } catch {
    return false;
  }
}

export function parseCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers.cookie;
  const out: Record<string, string> = {};
  if (!header) return out;

  for (const pair of header.split(';')) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx).trim();
    const val = pair.slice(eqIdx + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  }
  return out;
}

export function isRequestAuthenticated(req: IncomingMessage): boolean {
  const cookies = parseCookies(req);
  return verifySignedSessionToken(cookies[SESSION_COOKIE_NAME]);
}

export function buildSessionCookieHeader(
  token: string,
  req: IncomingMessage,
  clear = false
): string {
  const protoHeader = req.headers['x-forwarded-proto'];
  const isHttps =
    process.env.NODE_ENV === 'production' ||
    protoHeader === 'https' ||
    Boolean((req.socket as { encrypted?: boolean }).encrypted);

  const maxAge = clear ? 0 : getSessionMaxAgeSeconds();
  const segments = [
    `${SESSION_COOKIE_NAME}=${clear ? '' : encodeURIComponent(token)}`,
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
