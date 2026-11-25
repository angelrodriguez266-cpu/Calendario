import crypto from 'node:crypto';
import { getSessionSecret } from './sessionToken.ts';

interface RateLimitEntry {
  failures: number;
  windowStartMs: number;
  blockedUntilMs: number;
}

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;
const BLOCK_DURATION_MS = 5 * 60 * 1000;

const rateLimitStore = new Map<string, RateLimitEntry>();

const DUMMY_SALT = '0123456789abcdef0123456789abcdef';
const DUMMY_HASH = Buffer.alloc(64, 0);

function parsePasswordHash(
  raw: string
): { salt: string; expectedKey: Buffer } | null {
  const separator = raw.includes(':') ? ':' : '$';
  const parts = raw.split(separator);
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return null;
  }
  const [, salt, hexHash] = parts;
  if (!salt || salt.length < 16 || !/^[0-9a-fA-F]+$/.test(hexHash)) {
    return null;
  }
  const expectedKey = Buffer.from(hexHash, 'hex');
  if (expectedKey.length !== 64) {
    return null;
  }
  return { salt, expectedKey };
}

export function isServerAuthConfigured(): boolean {
  const rawHash = process.env.CALENDAR_PASSWORD_HASH?.trim();
  const secret = getSessionSecret();
  if (!rawHash || !secret) return false;
  return parsePasswordHash(rawHash) !== null;
}

export function checkRateLimit(clientKey: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(clientKey);
  if (!entry) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (entry.blockedUntilMs > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((entry.blockedUntilMs - now) / 1000),
    };
  }
  if (now - entry.windowStartMs > WINDOW_MS) {
    rateLimitStore.delete(clientKey);
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordFailedAttempt(clientKey: string): void {
  const now = Date.now();
  const current = rateLimitStore.get(clientKey);

  if (!current || now - current.windowStartMs > WINDOW_MS) {
    rateLimitStore.set(clientKey, {
      failures: 1,
      windowStartMs: now,
      blockedUntilMs: 0,
    });
    return;
  }

  const failures = current.failures + 1;
  rateLimitStore.set(clientKey, {
    failures,
    windowStartMs: current.windowStartMs,
    blockedUntilMs: failures >= MAX_ATTEMPTS ? now + BLOCK_DURATION_MS : 0,
  });
}

export function clearFailedAttempts(clientKey: string): void {
  rateLimitStore.delete(clientKey);
}

export function verifyAccessPassword(candidatePassword: string): boolean {
  const normalized = candidatePassword.normalize('NFKC');
  const rawHash = process.env.CALENDAR_PASSWORD_HASH?.trim() ?? '';
  const parsed = parsePasswordHash(rawHash);

  if (!parsed) {
    crypto.scryptSync(normalized, DUMMY_SALT, 64);
    crypto.timingSafeEqual(DUMMY_HASH, DUMMY_HASH);
    return false;
  }

  const derived = crypto.scryptSync(normalized, parsed.salt, 64);
  if (derived.length !== parsed.expectedKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(derived, parsed.expectedKey);
}
