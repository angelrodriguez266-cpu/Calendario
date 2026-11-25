// src/server/server.ts
import http from "node:http";
import fs from "node:fs/promises";
import path2 from "node:path";

// src/data/calendarDays.ts
var ICON_ROTATION = [
  "pine",
  "gift",
  "heart",
  "letter",
  "sparkle"
];
function getDefaultIconForDay(day) {
  if (day === 25) return "star-christmas";
  if (day === 31) return "finale-crown";
  return ICON_ROTATION[(day - 1) % ICON_ROTATION.length];
}
function getSpecialMilestone(day) {
  if (day === 25) return "christmas";
  if (day === 31) return "finale";
  return null;
}
var CUSTOM_SURPRISES_BY_DAY = {
  // Inicialmente todos los días permanecen en estado provisional (`isConfigured: false`)
  // sin inventar contenidos personales.
};
var CALENDAR_DAYS_2026 = Array.from(
  { length: 31 },
  (_, index) => {
    const day = index + 1;
    const custom = CUSTOM_SURPRISES_BY_DAY[day] ?? {};
    return {
      day,
      dateLabel: `${day} de diciembre de 2026`,
      cardIcon: custom.cardIcon ?? getDefaultIconForDay(day),
      specialMilestone: custom.specialMilestone ?? getSpecialMilestone(day),
      isConfigured: custom.isConfigured ?? false,
      contentType: custom.contentType ?? "pending",
      title: custom.title,
      subtitle: custom.subtitle,
      bodyParagraphs: custom.bodyParagraphs,
      signature: custom.signature,
      mediaAssets: custom.mediaAssets
    };
  }
);
function getDayDefinition(day) {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return void 0;
  }
  return CALENDAR_DAYS_2026[day - 1];
}

// src/server/adminHtmlShell.ts
function renderAdminHtmlShell(bootstrap) {
  const safeJson = JSON.stringify(bootstrap).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="theme-color" content="#263B32" />
    <title>Panel de administraci\xF3n \u2014 M&amp;A</title>

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Allura&family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..600&family=DM+Sans:ital,opsz,wght@0,9..40,300..600;1,9..40,400&display=swap"
      rel="stylesheet"
    />

    <link rel="stylesheet" href="/styles/tokens.css" />
    <link rel="stylesheet" href="/styles/base.css" />
    <link rel="stylesheet" href="/styles/admin.css" />
  </head>
  <body class="admin-body">
    <div id="admin-root"></div>

    <script id="ma-admin-bootstrap" type="application/json">${safeJson}</script>
    <script type="module" src="/js/admin/adminMain.js"></script>
  </body>
</html>`;
}

// src/server/bogotaTime.ts
var BOGOTA_TIMEZONE = "America/Bogota";
var devBaseRealMs = null;
var devBaseTargetIso = null;
function resolveEffectiveEpochMs() {
  if (process.env.NODE_ENV !== "production") {
    const devIso = process.env.CALENDAR_DEV_BOGOTA_ISO?.trim();
    if (devIso) {
      const parsedMs = Date.parse(devIso);
      if (!Number.isNaN(parsedMs)) {
        if (process.env.CALENDAR_DEV_BOGOTA_LIVE_TICK === "true") {
          if (devBaseTargetIso !== devIso || devBaseRealMs === null) {
            devBaseTargetIso = devIso;
            devBaseRealMs = Date.now();
          }
          const elapsed = Date.now() - devBaseRealMs;
          return { epochMs: parsedMs + elapsed, isDevSimulated: true };
        }
        return { epochMs: parsedMs, isDevSimulated: true };
      }
    }
  }
  return { epochMs: Date.now(), isDevSimulated: false };
}
function getBogotaClockSnapshot() {
  const { epochMs, isDevSimulated } = resolveEffectiveEpochMs();
  const instant = new Date(epochMs);
  const partsFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOGOTA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const parts = partsFormatter.formatToParts(instant);
  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }
  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  const hour = Number(map.hour);
  const minute = Number(map.minute);
  const second = Number(map.second);
  const milliseconds = instant.getUTCMilliseconds();
  const secondsElapsedToday = hour * 3600 + minute * 60 + second;
  const msElapsedToday = secondsElapsedToday * 1e3 + milliseconds;
  const msInDay = 24 * 60 * 60 * 1e3;
  const msUntilNextMidnight = Math.max(400, msInDay - msElapsedToday);
  const formattedDateEs = new Intl.DateTimeFormat("es-CO", {
    timeZone: BOGOTA_TIMEZONE,
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(instant);
  const formattedTimeEs = new Intl.DateTimeFormat("es-CO", {
    timeZone: BOGOTA_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(instant);
  let calendarPhase;
  if (year < 2026 || year === 2026 && month < 12) {
    calendarPhase = "before_december";
  } else if (year === 2026 && month === 12) {
    calendarPhase = "december_active";
  } else {
    calendarPhase = "after_december";
  }
  const pad = (n) => String(n).padStart(2, "0");
  const bogotaIso = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}-05:00`;
  return {
    serverTimestampMs: epochMs,
    bogotaIso,
    formattedDateEs,
    formattedTimeEs,
    year,
    month,
    day,
    hour,
    minute,
    second,
    msUntilNextMidnight,
    calendarPhase,
    isDevSimulated
  };
}
function getDayUnlockState(dayNumber, clock = getBogotaClockSnapshot()) {
  if (clock.calendarPhase === "before_december") {
    return "locked";
  }
  if (clock.calendarPhase === "after_december") {
    return "unlocked";
  }
  if (dayNumber < clock.day) {
    return "unlocked";
  }
  if (dayNumber === clock.day) {
    return "today";
  }
  return "locked";
}

// src/server/adminSession.ts
import crypto2 from "node:crypto";

// src/server/sessionToken.ts
import crypto from "node:crypto";
var SESSION_COOKIE_NAME = "ma_private_session";
var DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
function getSessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 24) {
    return null;
  }
  return secret;
}
function getSessionMaxAgeSeconds() {
  const raw = Number(process.env.SESSION_MAX_AGE_SECONDS);
  if (Number.isFinite(raw) && raw >= 300 && raw <= 60 * 60 * 24 * 60) {
    return Math.floor(raw);
  }
  return DEFAULT_MAX_AGE_SECONDS;
}
function createSignedSessionToken() {
  const secret = getSessionSecret();
  if (!secret) return null;
  const nowSec = Math.floor(Date.now() / 1e3);
  const payload = {
    sub: "maria-y-angel",
    iat: nowSec,
    exp: nowSec + getSessionMaxAgeSeconds()
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sigB64 = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sigB64}`;
}
function verifySignedSessionToken(token) {
  if (!token) return false;
  const secret = getSessionSecret();
  if (!secret) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return false;
  const expectedSig = crypto.createHmac("sha256", secret).update(payloadB64).digest();
  let providedSig;
  try {
    providedSig = Buffer.from(sigB64, "base64url");
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
    const rawJson = Buffer.from(payloadB64, "base64url").toString("utf8");
    const decoded = JSON.parse(rawJson);
    if (decoded.sub !== "maria-y-angel" || typeof decoded.exp !== "number") {
      return false;
    }
    const nowSec = Math.floor(Date.now() / 1e3);
    return decoded.exp > nowSec;
  } catch {
    return false;
  }
}
function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const pair of header.split(";")) {
    const eqIdx = pair.indexOf("=");
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
function isRequestAuthenticated(req) {
  const cookies = parseCookies(req);
  return verifySignedSessionToken(cookies[SESSION_COOKIE_NAME]);
}
function buildSessionCookieHeader(token, req, clear = false) {
  const protoHeader = req.headers["x-forwarded-proto"];
  const isHttps = process.env.NODE_ENV === "production" || protoHeader === "https" || Boolean(req.socket.encrypted);
  const maxAge = clear ? 0 : getSessionMaxAgeSeconds();
  const segments = [
    `${SESSION_COOKIE_NAME}=${clear ? "" : encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAge}`
  ];
  if (isHttps) {
    segments.push("Secure");
  }
  return segments.join("; ");
}

// src/server/adminSession.ts
var ADMIN_COOKIE_NAME = "ma_admin_session";
var ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12;
var adminRateMap = /* @__PURE__ */ new Map();
var ADMIN_MAX_ATTEMPTS = 5;
var ADMIN_WINDOW_MS = 10 * 60 * 1e3;
var ADMIN_BLOCK_MS = 10 * 60 * 1e3;
function getAdminSigningSecret() {
  const dedicated = process.env.ADMIN_SESSION_SECRET?.trim();
  if (dedicated && dedicated.length >= 24) return dedicated;
  const fallback = process.env.SESSION_SECRET?.trim();
  if (fallback && fallback.length >= 24) {
    return crypto2.createHash("sha256").update(`admin:${fallback}`).digest("hex");
  }
  return null;
}
function checkAdminRateLimit(clientKey) {
  const now = Date.now();
  const entry = adminRateMap.get(clientKey);
  if (!entry) return { allowed: true, retryAfterSeconds: 0 };
  if (entry.blockedUntilMs > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((entry.blockedUntilMs - now) / 1e3)
    };
  }
  if (now - entry.windowStartMs > ADMIN_WINDOW_MS) {
    adminRateMap.delete(clientKey);
  }
  return { allowed: true, retryAfterSeconds: 0 };
}
function recordAdminFailedLogin(clientKey) {
  const now = Date.now();
  const current = adminRateMap.get(clientKey);
  if (!current || now - current.windowStartMs > ADMIN_WINDOW_MS) {
    adminRateMap.set(clientKey, {
      failures: 1,
      windowStartMs: now,
      blockedUntilMs: 0
    });
    return;
  }
  const failures = current.failures + 1;
  adminRateMap.set(clientKey, {
    failures,
    windowStartMs: current.windowStartMs,
    blockedUntilMs: failures >= ADMIN_MAX_ATTEMPTS ? now + ADMIN_BLOCK_MS : 0
  });
}
function clearAdminFailedLogins(clientKey) {
  adminRateMap.delete(clientKey);
}
function createAdminSessionToken(user) {
  const secret = getAdminSigningSecret();
  if (!secret) return null;
  const nowSec = Math.floor(Date.now() / 1e3);
  const payload = {
    sub: "admin",
    uid: user.uid,
    email: user.email,
    iat: nowSec,
    exp: nowSec + ADMIN_SESSION_TTL_SECONDS
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sigB64 = crypto2.createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sigB64}`;
}
function verifyAdminSessionToken(token) {
  if (!token) return null;
  const secret = getAdminSigningSecret();
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;
  const expectedSig = crypto2.createHmac("sha256", secret).update(payloadB64).digest();
  let providedSig;
  try {
    providedSig = Buffer.from(sigB64, "base64url");
  } catch {
    return null;
  }
  if (providedSig.length !== expectedSig.length || !crypto2.timingSafeEqual(providedSig, expectedSig)) {
    return null;
  }
  try {
    const raw = Buffer.from(payloadB64, "base64url").toString("utf8");
    const decoded = JSON.parse(raw);
    if (decoded.sub !== "admin" || typeof decoded.uid !== "string" || typeof decoded.email !== "string" || typeof decoded.exp !== "number") {
      return null;
    }
    const nowSec = Math.floor(Date.now() / 1e3);
    if (decoded.exp <= nowSec) return null;
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}
function getAuthenticatedAdmin(req) {
  const cookies = parseCookies(req);
  return verifyAdminSessionToken(cookies[ADMIN_COOKIE_NAME]);
}
function buildAdminCookieHeader(token, req, clear = false) {
  const protoHeader = req.headers["x-forwarded-proto"];
  const isHttps = process.env.NODE_ENV === "production" || protoHeader === "https" || Boolean(req.socket.encrypted);
  const maxAge = clear ? 0 : ADMIN_SESSION_TTL_SECONDS;
  const segments = [
    `${ADMIN_COOKIE_NAME}=${clear ? "" : encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAge}`
  ];
  if (isHttps) {
    segments.push("Secure");
  }
  return segments.join("; ");
}

// src/server/fileValidation.ts
import crypto3 from "node:crypto";
import path from "node:path";
var FILE_RULES = {
  image: {
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    extensions: [".jpg", ".jpeg", ".png", ".webp"],
    maxBytes: 15 * 1024 * 1024,
    // 15 MB
    bucket: "surprise-media",
    label: "Imagen (JPG, PNG, WEBP \u2014 m\xE1x. 15 MB)"
  },
  video: {
    mimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
    extensions: [".mp4", ".webm", ".mov"],
    maxBytes: 100 * 1024 * 1024,
    // 100 MB
    bucket: "surprise-media",
    label: "Video (MP4, WEBM, MOV \u2014 m\xE1x. 100 MB)"
  },
  audio: {
    mimeTypes: ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a"],
    extensions: [".mp3", ".wav", ".m4a"],
    maxBytes: 35 * 1024 * 1024,
    // 35 MB
    bucket: "surprise-media",
    label: "Audio (MP3, WAV, M4A \u2014 m\xE1x. 35 MB)"
  },
  pdf: {
    mimeTypes: ["application/pdf"],
    extensions: [".pdf"],
    maxBytes: 25 * 1024 * 1024,
    // 25 MB
    bucket: "surprise-documents",
    label: "Documento PDF (m\xE1x. 25 MB)"
  }
};
var VALID_ROLES = /* @__PURE__ */ new Set([
  "primary",
  "cover",
  "gallery_item",
  "attachment_image",
  "pdf_document",
  "extra"
]);
function sanitizeMediaRole(raw) {
  if (typeof raw === "string" && VALID_ROLES.has(raw)) {
    return raw;
  }
  return "primary";
}
function validateUploadedFile(input) {
  const cleanBase = path.basename(input.fileName || "").trim();
  if (!cleanBase) {
    return { ok: false, error: "Nombre de archivo inv\xE1lido." };
  }
  const ext = path.extname(cleanBase).toLowerCase();
  const normalizedMime = (input.mimeType || "").split(";")[0].trim().toLowerCase();
  let matchedCategory = null;
  for (const [category, rule2] of Object.entries(FILE_RULES)) {
    if (rule2.extensions.includes(ext) && rule2.mimeTypes.includes(normalizedMime)) {
      matchedCategory = category;
      break;
    }
  }
  if (!matchedCategory) {
    return {
      ok: false,
      error: `Formato no permitido (${ext || "sin extensi\xF3n"} / ${normalizedMime || "desconocido"}). Formatos admitidos: JPG, PNG, WEBP, MP4, WEBM, MP3, WAV, M4A y PDF.`
    };
  }
  const rule = FILE_RULES[matchedCategory];
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, error: "El archivo est\xE1 vac\xEDo." };
  }
  if (input.sizeBytes > rule.maxBytes) {
    const maxMb = Math.round(rule.maxBytes / (1024 * 1024));
    return {
      ok: false,
      error: `El archivo supera el l\xEDmite m\xE1ximo permitido de ${maxMb} MB para ${matchedCategory}.`
    };
  }
  const safeStem = path.basename(cleanBase, ext).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "archivo";
  return {
    ok: true,
    bucket: rule.bucket,
    category: matchedCategory,
    safeFileName: `${safeStem}${ext}`
  };
}
function buildStorageObjectPath(dayNumber, safeFileName) {
  const paddedDay = String(dayNumber).padStart(2, "0");
  const uniqueId = crypto3.randomUUID().slice(0, 12);
  return `day-${paddedDay}/${uniqueId}-${safeFileName}`;
}

// src/server/supabaseClient.ts
var TUS_CHUNK_THRESHOLD_BYTES = 6 * 1024 * 1024;
var TUS_CHUNK_SIZE_BYTES = 2 * 1024 * 1024;
function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "") || "";
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  const allowedEmails = (process.env.ADMIN_ALLOWED_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return { url, publishableKey, serviceRoleKey, allowedEmails };
}
function isSupabaseConfigured() {
  const { url, publishableKey, serviceRoleKey } = getSupabaseEnv();
  return Boolean(
    url && (url.startsWith("https://") || url.startsWith("http://")) && publishableKey.length >= 16 && serviceRoleKey.length >= 16
  );
}
function getSupabaseStatusSummary() {
  const { url, publishableKey, serviceRoleKey, allowedEmails } = getSupabaseEnv();
  return {
    configured: isSupabaseConfigured(),
    hasUrl: Boolean(url),
    hasPublishableKey: Boolean(publishableKey),
    hasServiceRoleKey: Boolean(serviceRoleKey),
    allowedEmailsCount: allowedEmails.length
  };
}
async function supabaseRest(restPath, options = {}) {
  const { url, serviceRoleKey } = getSupabaseEnv();
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json"
  };
  if (options.prefer) {
    headers.Prefer = options.prefer;
  }
  const res = await fetch(`${url}/rest/v1/${restPath}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== void 0 ? JSON.stringify(options.body) : void 0
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Supabase REST ${res.status}: ${errText}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
async function authenticateAdminWithSupabase(email, password) {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      status: 503,
      code: "SUPABASE_NOT_CONFIGURED",
      message: "Supabase a\xFAn no est\xE1 configurado en el servidor. Define SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY y ADMIN_ALLOWED_EMAILS en .env.local."
    };
  }
  const { url, publishableKey, allowedEmails } = getSupabaseEnv();
  const normalizedEmail = email.trim().toLowerCase();
  let authRes;
  try {
    authRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: normalizedEmail,
        password
      })
    });
  } catch {
    return {
      ok: false,
      status: 502,
      code: "SUPABASE_UNREACHABLE",
      message: "No fue posible conectar con Supabase Auth. Verifica SUPABASE_URL y tu conexi\xF3n."
    };
  }
  if (!authRes.ok) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_CREDENTIALS",
      message: "Correo o contrase\xF1a incorrectos."
    };
  }
  const authData = await authRes.json();
  const userId = authData.user?.id;
  const userEmail = authData.user?.email?.toLowerCase();
  if (!userId || !userEmail) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_SESSION",
      message: "Supabase Auth no devolvi\xF3 un usuario v\xE1lido."
    };
  }
  if (allowedEmails.length > 0 && !allowedEmails.includes(userEmail)) {
    return {
      ok: false,
      status: 403,
      code: "NOT_AUTHORIZED_ADMIN",
      message: "Esta cuenta no est\xE1 autorizada para acceder al panel de administraci\xF3n."
    };
  }
  try {
    const rows = await supabaseRest(
      `admin_users?user_id=eq.${encodeURIComponent(userId)}&select=user_id,email`
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return {
        ok: false,
        status: 403,
        code: "NOT_AUTHORIZED_ADMIN",
        message: "Esta cuenta no tiene permisos de administrador asignados en admin_users."
      };
    }
  } catch {
    return {
      ok: false,
      status: 503,
      code: "ADMIN_TABLE_UNAVAILABLE",
      message: "No se pudo verificar la tabla admin_users en Supabase. Aseg\xFArate de ejecutar las migraciones SQL."
    };
  }
  return { ok: true, uid: userId, email: userEmail };
}
async function verifyAdminAuthorizationInDb(uid, email) {
  if (!isSupabaseConfigured()) return false;
  const { allowedEmails } = getSupabaseEnv();
  if (allowedEmails.length > 0 && !allowedEmails.includes(email.toLowerCase())) {
    return false;
  }
  try {
    const rows = await supabaseRest(
      `admin_users?user_id=eq.${encodeURIComponent(uid)}&select=user_id`
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}
async function createSignedStorageUrl(bucket, storagePath, expiresInSeconds = 600) {
  const { url, serviceRoleKey } = getSupabaseEnv();
  const encodedPath = storagePath.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  try {
    const res = await fetch(
      `${url}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodedPath}`,
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ expiresIn: expiresInSeconds })
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const rel = data.signedURL || data.signedUrl;
    if (!rel) return null;
    if (rel.startsWith("http://") || rel.startsWith("https://")) {
      return rel;
    }
    return `${url}/storage/v1${rel.startsWith("/") ? "" : "/"}${rel}`;
  } catch {
    return null;
  }
}
async function uploadBufferToSupabaseStorage(params) {
  const { url, serviceRoleKey } = getSupabaseEnv();
  if (params.buffer.byteLength > TUS_CHUNK_THRESHOLD_BYTES) {
    const metadataHeader = [
      `bucketName ${Buffer.from(params.bucket).toString("base64")}`,
      `objectName ${Buffer.from(params.storagePath).toString("base64")}`,
      `contentType ${Buffer.from(params.contentType).toString("base64")}`
    ].join(",");
    const createRes = await fetch(`${url}/storage/v1/upload/resumable`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Tus-Resumable": "1.0.0",
        "Upload-Length": String(params.buffer.byteLength),
        "Upload-Metadata": metadataHeader,
        "x-upsert": "true"
      }
    });
    if (createRes.ok) {
      const location = createRes.headers.get("location");
      if (location) {
        const uploadUrl = location.startsWith("http") ? location : `${url}${location.startsWith("/") ? "" : "/"}${location}`;
        let offset = 0;
        while (offset < params.buffer.byteLength) {
          const chunk = params.buffer.subarray(
            offset,
            Math.min(offset + TUS_CHUNK_SIZE_BYTES, params.buffer.byteLength)
          );
          const patchRes = await fetch(uploadUrl, {
            method: "PATCH",
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
              "Tus-Resumable": "1.0.0",
              "Upload-Offset": String(offset),
              "Content-Type": "application/offset+octet-stream"
            },
            body: chunk
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
  const encodedPath = params.storagePath.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  const res = await fetch(
    `${url}/storage/v1/object/${encodeURIComponent(params.bucket)}/${encodedPath}`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": params.contentType,
        "x-upsert": "true"
      },
      body: params.buffer
    }
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Error subiendo archivo a Storage (${res.status}): ${errText}`);
  }
}
async function deleteObjectFromSupabaseStorage(bucket, storagePath) {
  const { url, serviceRoleKey } = getSupabaseEnv();
  await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}`, {
    method: "DELETE",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ prefixes: [storagePath] })
  });
}
async function listAllAdminCalendarDays() {
  const [days, surprises, files] = await Promise.all([
    supabaseRest(
      "calendar_days?select=*&order=day_number.asc"
    ),
    supabaseRest("surprises?select=*"),
    supabaseRest(
      "surprise_files?select=id,surprise_id"
    )
  ]);
  const surpriseByDayId = /* @__PURE__ */ new Map();
  for (const s of surprises || []) {
    surpriseByDayId.set(s.calendar_day_id, s);
  }
  const fileCountBySurpriseId = /* @__PURE__ */ new Map();
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
      surprise: s ? { ...s, files_count: fileCountBySurpriseId.get(s.id) ?? 0 } : null,
      display_status: s ? s.status : "empty"
    };
  });
}
async function getAdminDashboardData(clock) {
  const days = await listAllAdminCalendarDays();
  let createdCount = 0;
  let publishedCount = 0;
  let scheduledCount = 0;
  let draftCount = 0;
  let nextPublication = null;
  for (const item of days) {
    if (item.surprise) {
      createdCount++;
      if (item.surprise.status === "published") publishedCount++;
      else if (item.surprise.status === "scheduled") scheduledCount++;
      else draftCount++;
      if ((item.surprise.status === "scheduled" || item.surprise.status === "published") && Date.parse(item.unlock_at) >= clock.serverTimestampMs) {
        if (!nextPublication || Date.parse(item.unlock_at) < Date.parse(nextPublication.unlock_at)) {
          nextPublication = {
            day_number: item.day_number,
            title: item.surprise.title,
            unlock_at: item.unlock_at
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
      nextPublication
    },
    days
  };
}
async function getAdminDayDetail(dayNumber) {
  const dayRows = await supabaseRest(
    `calendar_days?day_number=eq.${dayNumber}&select=*`
  );
  const day = dayRows?.[0];
  if (!day) return null;
  const surpriseRows = await supabaseRest(
    `surprises?calendar_day_id=eq.${encodeURIComponent(day.id)}&select=*`
  );
  const surprise = surpriseRows?.[0] ?? null;
  let files = [];
  if (surprise) {
    const rawFiles = await supabaseRest(
      `surprise_files?surprise_id=eq.${encodeURIComponent(surprise.id)}&select=*&order=display_order.asc,created_at.asc`
    );
    files = await Promise.all(
      (rawFiles || []).map(async (f) => ({
        ...f,
        signed_url: await createSignedStorageUrl(f.bucket_name, f.storage_path, 900)
      }))
    );
  }
  return { day, surprise, files };
}
async function upsertAdminDaySurprise(input) {
  const dayRows = await supabaseRest(
    `calendar_days?day_number=eq.${input.dayNumber}&select=*`
  );
  let day = dayRows?.[0];
  if (!day) {
    const createdDays = await supabaseRest("calendar_days", {
      method: "POST",
      prefer: "return=representation",
      body: {
        day_number: input.dayNumber,
        unlock_at: input.unlockAt || `2026-12-${String(input.dayNumber).padStart(2, "0")}T00:00:00-05:00`
      }
    });
    day = createdDays[0];
  } else if (input.unlockAt && input.unlockAt !== day.unlock_at) {
    const updatedDays = await supabaseRest(
      `calendar_days?id=eq.${encodeURIComponent(day.id)}`,
      {
        method: "PATCH",
        prefer: "return=representation",
        body: { unlock_at: input.unlockAt }
      }
    );
    if (updatedDays?.[0]) day = updatedDays[0];
  }
  const existing = await supabaseRest(
    `surprises?calendar_day_id=eq.${encodeURIComponent(day.id)}&select=*`
  );
  const surprisePayload = {
    calendar_day_id: day.id,
    title: input.title.trim(),
    subtitle: input.subtitle?.trim() || null,
    description: input.description?.trim() || null,
    content_type: input.contentType,
    content_data: input.contentData ?? {},
    status: input.status
  };
  if (existing?.[0]) {
    await supabaseRest(
      `surprises?id=eq.${encodeURIComponent(existing[0].id)}`,
      {
        method: "PATCH",
        prefer: "return=representation",
        body: surprisePayload
      }
    );
  } else {
    await supabaseRest("surprises", {
      method: "POST",
      prefer: "return=representation",
      body: surprisePayload
    });
  }
  const detail = await getAdminDayDetail(input.dayNumber);
  if (!detail) {
    throw new Error("No se pudo cargar la sorpresa despu\xE9s de guardarla.");
  }
  return detail;
}
async function deleteAdminDaySurprise(dayNumber) {
  const detail = await getAdminDayDetail(dayNumber);
  if (!detail?.surprise) return;
  for (const file of detail.files) {
    await deleteObjectFromSupabaseStorage(file.bucket_name, file.storage_path);
  }
  await supabaseRest(
    `surprises?id=eq.${encodeURIComponent(detail.surprise.id)}`,
    { method: "DELETE" }
  );
}
async function registerUploadedSurpriseFile(input) {
  let detail = await getAdminDayDetail(input.dayNumber);
  if (!detail?.surprise) {
    detail = await upsertAdminDaySurprise({
      dayNumber: input.dayNumber,
      title: `Borrador del D\xEDa ${input.dayNumber}`,
      contentType: input.bucket === "surprise-documents" ? "letter" : "gallery",
      contentData: {},
      status: "draft"
    });
  }
  const nextOrder = detail.files.length;
  const inserted = await supabaseRest("surprise_files", {
    method: "POST",
    prefer: "return=representation",
    body: {
      surprise_id: detail.surprise.id,
      bucket_name: input.bucket,
      storage_path: input.storagePath,
      file_name: input.fileName,
      file_type: input.fileType,
      file_size: input.fileSize,
      media_role: input.mediaRole,
      display_order: nextOrder
    }
  });
  const row = inserted[0];
  return {
    ...row,
    signed_url: await createSignedStorageUrl(row.bucket_name, row.storage_path, 900)
  };
}
async function listAllAdminMediaFiles() {
  const [days, surprises, files] = await Promise.all([
    supabaseRest("calendar_days?select=*"),
    supabaseRest("surprises?select=*"),
    supabaseRest("surprise_files?select=*&order=created_at.desc")
  ]);
  const dayById = new Map((days || []).map((d) => [d.id, d]));
  const surpriseById = new Map((surprises || []).map((s) => [s.id, s]));
  return Promise.all(
    (files || []).map(async (f) => {
      const surprise = surpriseById.get(f.surprise_id);
      const day = surprise ? dayById.get(surprise.calendar_day_id) : void 0;
      return {
        ...f,
        day_number: day?.day_number,
        surprise_title: surprise?.title,
        signed_url: await createSignedStorageUrl(f.bucket_name, f.storage_path, 900)
      };
    })
  );
}
async function deleteAdminFileById(fileId) {
  const rows = await supabaseRest(
    `surprise_files?id=eq.${encodeURIComponent(fileId)}&select=*`
  );
  const file = rows?.[0];
  if (!file) return false;
  await deleteObjectFromSupabaseStorage(file.bucket_name, file.storage_path);
  await supabaseRest(
    `surprise_files?id=eq.${encodeURIComponent(fileId)}`,
    { method: "DELETE" }
  );
  return true;
}
async function getPublicUnlockedDayFromSupabase(dayNumber, clock) {
  if (!isSupabaseConfigured()) return null;
  try {
    const dayRows = await supabaseRest(
      `calendar_days?day_number=eq.${dayNumber}&select=*`
    );
    const day = dayRows?.[0];
    if (!day) return null;
    const unlockMs = Date.parse(day.unlock_at);
    if (!Number.isNaN(unlockMs) && unlockMs > clock.serverTimestampMs) {
      return null;
    }
    const surpriseRows = await supabaseRest(
      `surprises?calendar_day_id=eq.${encodeURIComponent(day.id)}&status=in.(scheduled,published)&select=*`
    );
    const surprise = surpriseRows?.[0];
    if (!surprise) return null;
    const rawFiles = await supabaseRest(
      `surprise_files?surprise_id=eq.${encodeURIComponent(surprise.id)}&select=*&order=display_order.asc,created_at.asc`
    );
    const mediaUrls = (await Promise.all(
      (rawFiles || []).map(async (f) => {
        const signed = await createSignedStorageUrl(
          f.bucket_name,
          f.storage_path,
          600
        );
        if (!signed) return null;
        const kind = f.file_type.startsWith("image/") ? "image" : f.file_type.startsWith("video/") ? "video" : f.file_type.startsWith("audio/") ? "audio" : "pdf";
        return {
          id: f.id,
          kind,
          url: signed,
          caption: f.file_name,
          mimeType: f.file_type,
          mediaRole: f.media_role
        };
      })
    )).filter((item) => item !== null);
    const data = surprise.content_data || {};
    const letterText = typeof data.letterBody === "string" ? data.letterBody : "";
    const bodyParagraphs = letterText ? letterText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) : surprise.description ? surprise.description.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) : [];
    const mappedType = surprise.content_type === "special" ? "mixed" : surprise.content_type;
    return {
      day: dayNumber,
      dateLabel: `${dayNumber} de diciembre de 2026`,
      state: clock.calendarPhase === "december_active" && clock.day === dayNumber ? "today" : "unlocked",
      specialMilestone: dayNumber === 25 ? "christmas" : dayNumber === 31 ? "finale" : null,
      isConfigured: true,
      contentType: mappedType,
      title: surprise.title,
      subtitle: surprise.subtitle ?? void 0,
      bodyParagraphs,
      signature: typeof data.signature === "string" ? data.signature : void 0,
      contentData: data,
      mediaUrls
    };
  } catch {
    return null;
  }
}

// src/server/adminRoutes.ts
var VALID_CONTENT_TYPES = /* @__PURE__ */ new Set([
  "letter",
  "video",
  "audio",
  "gallery",
  "coupon",
  "special"
]);
var VALID_STATUSES = /* @__PURE__ */ new Set([
  "draft",
  "scheduled",
  "published"
]);
function sendJson(res, statusCode, data, extraHeaders) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store, no-cache, must-revalidate",
    ...extraHeaders
  });
  res.end(JSON.stringify(data));
}
function resolveClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress ?? "local-admin";
}
async function readJsonBody(req, maxBytes = 256e3) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("PAYLOAD_TOO_LARGE"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}
async function readBinaryBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("FILE_TOO_LARGE"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
async function handleAdminApiRequest(req, res, pathname) {
  if (pathname === "/api/admin/auth/login" && req.method === "POST") {
    const clientIp = resolveClientIp(req);
    const rate = checkAdminRateLimit(clientIp);
    if (!rate.allowed) {
      sendJson(
        res,
        429,
        {
          authenticated: false,
          code: "RATE_LIMITED",
          message: "Demasiados intentos de acceso. Espera unos minutos antes de volver a intentarlo."
        },
        { "Retry-After": String(rate.retryAfterSeconds) }
      );
      return;
    }
    let body;
    try {
      body = await readJsonBody(req, 8192);
    } catch {
      sendJson(res, 400, {
        authenticated: false,
        message: "Solicitud inv\xE1lida."
      });
      return;
    }
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) {
      sendJson(res, 400, {
        authenticated: false,
        message: "Ingresa tu correo electr\xF3nico y contrase\xF1a."
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
        message: authResult.message
      });
      return;
    }
    clearAdminFailedLogins(clientIp);
    const sessionToken = createAdminSessionToken({
      uid: authResult.uid,
      email: authResult.email
    });
    if (!sessionToken) {
      sendJson(res, 503, {
        authenticated: false,
        message: "Falta configurar SESSION_SECRET o ADMIN_SESSION_SECRET en el servidor."
      });
      return;
    }
    const cookieHeader = buildAdminCookieHeader(sessionToken, req, false);
    sendJson(
      res,
      200,
      {
        authenticated: true,
        user: { uid: authResult.uid, email: authResult.email }
      },
      { "Set-Cookie": cookieHeader }
    );
    return;
  }
  if (pathname === "/api/admin/auth/logout" && req.method === "POST") {
    const clearCookie = buildAdminCookieHeader("", req, true);
    sendJson(
      res,
      200,
      { authenticated: false },
      { "Set-Cookie": clearCookie }
    );
    return;
  }
  if (pathname === "/api/admin/auth/session" && req.method === "GET") {
    const sessionUser = getAuthenticatedAdmin(req);
    const authorized = sessionUser && isSupabaseConfigured() ? await verifyAdminAuthorizationInDb(sessionUser.uid, sessionUser.email) : false;
    sendJson(res, 200, {
      authenticated: Boolean(authorized),
      user: authorized ? sessionUser : null,
      supabaseStatus: getSupabaseStatusSummary(),
      bogotaNow: getBogotaClockSnapshot()
    });
    return;
  }
  const adminUser = getAuthenticatedAdmin(req);
  if (!adminUser) {
    sendJson(res, 401, {
      error: "No autorizado. Inicia sesi\xF3n como administrador."
    });
    return;
  }
  if (!isSupabaseConfigured()) {
    sendJson(res, 503, {
      error: "Supabase no est\xE1 configurado en el servidor."
    });
    return;
  }
  const stillAuthorized = await verifyAdminAuthorizationInDb(
    adminUser.uid,
    adminUser.email
  );
  if (!stillAuthorized) {
    const clearCookie = buildAdminCookieHeader("", req, true);
    sendJson(
      res,
      403,
      { error: "Permisos de administrador revocados o no autorizados." },
      { "Set-Cookie": clearCookie }
    );
    return;
  }
  try {
    if (pathname === "/api/admin/dashboard" && req.method === "GET") {
      const clock = getBogotaClockSnapshot();
      const dashboard = await getAdminDashboardData(clock);
      sendJson(res, 200, {
        ...dashboard,
        clock,
        user: adminUser
      });
      return;
    }
    if (pathname === "/api/admin/calendar" && req.method === "GET") {
      const days = await listAllAdminCalendarDays();
      sendJson(res, 200, { days, clock: getBogotaClockSnapshot() });
      return;
    }
    const dayMatch = pathname.match(/^\/api\/admin\/surprises\/(\d{1,2})$/);
    if (dayMatch) {
      const dayNumber = Number(dayMatch[1]);
      if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 31) {
        sendJson(res, 400, { error: "N\xFAmero de d\xEDa inv\xE1lido (debe estar entre 1 y 31)." });
        return;
      }
      if (req.method === "GET") {
        const detail = await getAdminDayDetail(dayNumber);
        if (!detail) {
          sendJson(res, 404, { error: `No se encontr\xF3 el d\xEDa ${dayNumber} en calendar_days.` });
          return;
        }
        sendJson(res, 200, detail);
        return;
      }
      if (req.method === "PUT") {
        const body = await readJsonBody(req);
        const title = typeof body.title === "string" ? body.title.trim() : "";
        const contentType = body.content_type;
        const status = body.status || "draft";
        if (!title) {
          sendJson(res, 400, { error: "El t\xEDtulo de la sorpresa es obligatorio." });
          return;
        }
        if (!VALID_CONTENT_TYPES.has(contentType)) {
          sendJson(res, 400, { error: "Tipo de contenido no v\xE1lido." });
          return;
        }
        if (!VALID_STATUSES.has(status)) {
          sendJson(res, 400, { error: "Estado de publicaci\xF3n no v\xE1lido." });
          return;
        }
        const unlockAt = typeof body.unlock_at === "string" && !Number.isNaN(Date.parse(body.unlock_at)) ? body.unlock_at : void 0;
        const saved = await upsertAdminDaySurprise({
          dayNumber,
          unlockAt,
          title,
          subtitle: typeof body.subtitle === "string" ? body.subtitle : null,
          description: typeof body.description === "string" ? body.description : null,
          contentType,
          contentData: body.content_data && typeof body.content_data === "object" ? body.content_data : {},
          status
        });
        sendJson(res, 200, saved);
        return;
      }
      if (req.method === "DELETE") {
        await deleteAdminDaySurprise(dayNumber);
        sendJson(res, 200, { deleted: true, day_number: dayNumber });
        return;
      }
    }
    if (pathname === "/api/admin/files" && req.method === "GET") {
      const files = await listAllAdminMediaFiles();
      sendJson(res, 200, { files });
      return;
    }
    if (pathname === "/api/admin/files/upload" && req.method === "POST") {
      const rawDay = Number(req.headers["x-day-number"]);
      if (!Number.isInteger(rawDay) || rawDay < 1 || rawDay > 31) {
        sendJson(res, 400, { error: "D\xEDa de calendario inv\xE1lido para adjuntar archivo." });
        return;
      }
      const rawFileNameHeader = req.headers["x-file-name"];
      const rawFileName = typeof rawFileNameHeader === "string" ? decodeURIComponent(rawFileNameHeader) : "";
      const mimeType = typeof req.headers["content-type"] === "string" ? req.headers["content-type"] : "application/octet-stream";
      const declaredLength = Number(req.headers["content-length"] || 0);
      const mediaRole = sanitizeMediaRole(req.headers["x-media-role"]);
      const maxAllowedOverall = FILE_RULES.video.maxBytes;
      if (declaredLength > maxAllowedOverall) {
        sendJson(res, 413, {
          error: "El archivo excede el tama\xF1o m\xE1ximo permitido de 100 MB."
        });
        return;
      }
      let fileBuffer;
      try {
        fileBuffer = await readBinaryBody(req, maxAllowedOverall);
      } catch {
        sendJson(res, 413, {
          error: "El archivo excede el tama\xF1o m\xE1ximo permitido."
        });
        return;
      }
      const validation = validateUploadedFile({
        fileName: rawFileName,
        mimeType,
        sizeBytes: fileBuffer.byteLength
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
        contentType: mimeType.split(";")[0].trim()
      });
      const record = await registerUploadedSurpriseFile({
        dayNumber: rawDay,
        bucket: validation.bucket,
        storagePath,
        fileName: rawFileName,
        fileType: mimeType.split(";")[0].trim(),
        fileSize: fileBuffer.byteLength,
        mediaRole
      });
      sendJson(res, 201, { file: record });
      return;
    }
    const fileMatch = pathname.match(/^\/api\/admin\/files\/([^/]+)$/);
    if (fileMatch && req.method === "DELETE") {
      const fileId = decodeURIComponent(fileMatch[1]);
      const deleted = await deleteAdminFileById(fileId);
      if (!deleted) {
        sendJson(res, 404, { error: "Archivo no encontrado." });
        return;
      }
      sendJson(res, 200, { deleted: true, id: fileId });
      return;
    }
    sendJson(res, 404, { error: "Endpoint administrativo no encontrado." });
  } catch (err) {
    console.error("Error en API de administraci\xF3n:", err);
    sendJson(res, 500, {
      error: "Ocurri\xF3 un error al comunicarse con Supabase. Revisa la configuraci\xF3n y migraciones."
    });
  }
}

// src/server/htmlShell.ts
function renderHtmlShell(bootstrap) {
  const safeJson = JSON.stringify(bootstrap).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="theme-color" content="#292724" />
    <title>Mar\xEDa y \xC1ngel: una Navidad juntos</title>
    <meta
      name="description"
      content="Calendario de Adviento digital privado \u2014 31 d\xEDas, 31 peque\xF1os detalles y una historia que sigue escribi\xE9ndose."
    />

    <!-- Google Fonts oficiales: Bodoni Moda, DM Sans y Allura -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Allura&family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..600&family=DM+Sans:ital,opsz,wght@0,9..40,300..600;1,9..40,400&display=swap"
      rel="stylesheet"
    />

    <!-- Sistema de estilos separado por responsabilidades y variables CSS -->
    <link rel="stylesheet" href="/styles/tokens.css" />
    <link rel="stylesheet" href="/styles/base.css" />
    <link rel="stylesheet" href="/styles/motion.css" />
    <link rel="stylesheet" href="/styles/decorative.css" />
    <link rel="stylesheet" href="/styles/hero.css" />
    <link rel="stylesheet" href="/styles/private-access.css" />
    <link rel="stylesheet" href="/styles/calendar.css" />
    <link rel="stylesheet" href="/styles/calendar-day.css" />
  </head>
  <body>
    <div id="app-root"></div>

    <script id="ma-bootstrap" type="application/json">${safeJson}</script>
    <script type="module" src="/js/main.js"></script>
  </body>
</html>`;
}

// src/server/passwordAuth.ts
import crypto4 from "node:crypto";
var MAX_ATTEMPTS = 5;
var WINDOW_MS = 10 * 60 * 1e3;
var BLOCK_DURATION_MS = 5 * 60 * 1e3;
var rateLimitStore = /* @__PURE__ */ new Map();
var DUMMY_SALT = "0123456789abcdef0123456789abcdef";
var DUMMY_HASH = Buffer.alloc(64, 0);
function parsePasswordHash(raw) {
  const separator = raw.includes(":") ? ":" : "$";
  const parts = raw.split(separator);
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return null;
  }
  const [, salt, hexHash] = parts;
  if (!salt || salt.length < 16 || !/^[0-9a-fA-F]+$/.test(hexHash)) {
    return null;
  }
  const expectedKey = Buffer.from(hexHash, "hex");
  if (expectedKey.length !== 64) {
    return null;
  }
  return { salt, expectedKey };
}
function isServerAuthConfigured() {
  const rawHash = process.env.CALENDAR_PASSWORD_HASH?.trim();
  const secret = getSessionSecret();
  if (!rawHash || !secret) return false;
  return parsePasswordHash(rawHash) !== null;
}
function checkRateLimit(clientKey) {
  const now = Date.now();
  const entry = rateLimitStore.get(clientKey);
  if (!entry) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (entry.blockedUntilMs > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((entry.blockedUntilMs - now) / 1e3)
    };
  }
  if (now - entry.windowStartMs > WINDOW_MS) {
    rateLimitStore.delete(clientKey);
  }
  return { allowed: true, retryAfterSeconds: 0 };
}
function recordFailedAttempt(clientKey) {
  const now = Date.now();
  const current = rateLimitStore.get(clientKey);
  if (!current || now - current.windowStartMs > WINDOW_MS) {
    rateLimitStore.set(clientKey, {
      failures: 1,
      windowStartMs: now,
      blockedUntilMs: 0
    });
    return;
  }
  const failures = current.failures + 1;
  rateLimitStore.set(clientKey, {
    failures,
    windowStartMs: current.windowStartMs,
    blockedUntilMs: failures >= MAX_ATTEMPTS ? now + BLOCK_DURATION_MS : 0
  });
}
function clearFailedAttempts(clientKey) {
  rateLimitStore.delete(clientKey);
}
function verifyAccessPassword(candidatePassword) {
  const normalized = candidatePassword.normalize("NFKC");
  const rawHash = process.env.CALENDAR_PASSWORD_HASH?.trim() ?? "";
  const parsed = parsePasswordHash(rawHash);
  if (!parsed) {
    crypto4.scryptSync(normalized, DUMMY_SALT, 64);
    crypto4.timingSafeEqual(DUMMY_HASH, DUMMY_HASH);
    return false;
  }
  const derived = crypto4.scryptSync(normalized, parsed.salt, 64);
  if (derived.length !== parsed.expectedKey.length) {
    return false;
  }
  return crypto4.timingSafeEqual(derived, parsed.expectedKey);
}

// src/server/server.ts
var PORT = Number(process.env.PORT) || 3e3;
var PUBLIC_DIR = path2.resolve(process.cwd(), "public");
var PRIVATE_CONTENT_DIR = path2.resolve(process.cwd(), "private-content");
var MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};
function setCommonSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
}
function sendJson2(res, statusCode, data, extraHeaders) {
  setCommonSecurityHeaders(res);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store, no-cache, must-revalidate",
    ...extraHeaders
  });
  res.end(JSON.stringify(data));
}
function resolveClientIp2(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress ?? "local-client";
}
async function readJsonBody2(req, maxBytes = 4096) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("PAYLOAD_TOO_LARGE"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}
function buildCalendarOverview() {
  const clock = getBogotaClockSnapshot();
  const days = CALENDAR_DAYS_2026.map((entry) => ({
    day: entry.day,
    dateLabel: entry.dateLabel,
    state: getDayUnlockState(entry.day, clock),
    cardIcon: entry.cardIcon,
    specialMilestone: entry.specialMilestone,
    isConfigured: entry.isConfigured
  }));
  return { clock, days };
}
var sseClients = /* @__PURE__ */ new Set();
var midnightBroadcastTimer = null;
function scheduleNextBogotaMidnightBroadcast() {
  if (midnightBroadcastTimer) {
    clearTimeout(midnightBroadcastTimer);
  }
  const clock = getBogotaClockSnapshot();
  const delayMs = Math.min(clock.msUntilNextMidnight + 250, 60 * 60 * 1e3);
  midnightBroadcastTimer = setTimeout(() => {
    if (sseClients.size > 0) {
      const payload = JSON.stringify(buildCalendarOverview());
      for (const client of sseClients) {
        try {
          client.write(`event: calendar-sync
data: ${payload}

`);
        } catch {
          sseClients.delete(client);
        }
      }
    }
    scheduleNextBogotaMidnightBroadcast();
  }, delayMs);
}
scheduleNextBogotaMidnightBroadcast();
async function handleApiRequest(req, res, pathname) {
  if (pathname === "/api/auth/login" && req.method === "POST") {
    if (!isServerAuthConfigured()) {
      sendJson2(res, 503, {
        authenticated: false,
        code: "SERVER_NOT_CONFIGURED",
        message: "El acceso privado est\xE1 protegido en el servidor y a\xFAn requiere configurar CALENDAR_PASSWORD_HASH y SESSION_SECRET en .env.local."
      });
      return;
    }
    const clientIp = resolveClientIp2(req);
    const rate = checkRateLimit(clientIp);
    if (!rate.allowed) {
      sendJson2(
        res,
        429,
        {
          authenticated: false,
          code: "RATE_LIMITED",
          message: "Demasiados intentos seguidos. Espera unos minutos antes de volver a intentarlo.",
          retryAfterSeconds: rate.retryAfterSeconds
        },
        { "Retry-After": String(rate.retryAfterSeconds) }
      );
      return;
    }
    let body;
    try {
      body = await readJsonBody2(req);
    } catch {
      sendJson2(res, 400, {
        authenticated: false,
        code: "BAD_REQUEST",
        message: "Solicitud inv\xE1lida."
      });
      return;
    }
    const candidate = typeof body.password === "string" ? body.password : "";
    if (!candidate || candidate.length > 256) {
      recordFailedAttempt(clientIp);
      sendJson2(res, 401, {
        authenticated: false,
        code: "INVALID_PASSWORD",
        message: "Esa clave no coincide con nuestro secreto. Int\xE9ntalo nuevamente con calma."
      });
      return;
    }
    const isValid = verifyAccessPassword(candidate);
    if (!isValid) {
      recordFailedAttempt(clientIp);
      sendJson2(res, 401, {
        authenticated: false,
        code: "INVALID_PASSWORD",
        message: "Esa clave no coincide con nuestro secreto. Int\xE9ntalo nuevamente con calma."
      });
      return;
    }
    clearFailedAttempts(clientIp);
    const sessionToken = createSignedSessionToken();
    if (!sessionToken) {
      sendJson2(res, 503, {
        authenticated: false,
        code: "SERVER_NOT_CONFIGURED",
        message: "Falta configurar SESSION_SECRET en el servidor."
      });
      return;
    }
    const cookieHeader = buildSessionCookieHeader(sessionToken, req, false);
    sendJson2(
      res,
      200,
      { authenticated: true },
      { "Set-Cookie": cookieHeader }
    );
    return;
  }
  if (pathname === "/api/auth/logout" && req.method === "POST") {
    const clearHeader = buildSessionCookieHeader("", req, true);
    sendJson2(
      res,
      200,
      { authenticated: false },
      { "Set-Cookie": clearHeader }
    );
    return;
  }
  if (pathname === "/api/auth/session" && req.method === "GET") {
    const configured = isServerAuthConfigured();
    const authenticated = configured ? isRequestAuthenticated(req) : false;
    sendJson2(res, 200, { authenticated, configured });
    return;
  }
  if (pathname.startsWith("/api/calendar")) {
    if (!isServerAuthConfigured() || !isRequestAuthenticated(req)) {
      sendJson2(res, 401, {
        error: "No autorizado. Ingresa la clave privada para acceder al calendario."
      });
      return;
    }
    if (pathname === "/api/calendar" && req.method === "GET") {
      sendJson2(res, 200, buildCalendarOverview());
      return;
    }
    if (pathname === "/api/calendar/stream" && req.method === "GET") {
      setCommonSecurityHeaders(res);
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "private, no-cache, no-transform",
        Connection: "keep-alive"
      });
      res.write(`event: calendar-sync
data: ${JSON.stringify(buildCalendarOverview())}

`);
      sseClients.add(res);
      const keepAlive = setInterval(() => {
        try {
          res.write(": heartbeat\n\n");
        } catch {
          clearInterval(keepAlive);
          sseClients.delete(res);
        }
      }, 25e3);
      req.on("close", () => {
        clearInterval(keepAlive);
        sseClients.delete(res);
      });
      return;
    }
    const dayMatch = pathname.match(/^\/api\/calendar\/(\d{1,2})$/);
    if (dayMatch && req.method === "GET") {
      const dayNumber = Number(dayMatch[1]);
      const definition = getDayDefinition(dayNumber);
      if (!definition) {
        sendJson2(res, 404, { error: "D\xEDa fuera del rango del calendario (1\u201331)." });
        return;
      }
      const clock = getBogotaClockSnapshot();
      const state = getDayUnlockState(dayNumber, clock);
      if (state === "locked") {
        sendJson2(res, 403, {
          code: "DAY_LOCKED",
          error: `El d\xEDa ${dayNumber} de diciembre permanece bloqueado hasta las 00:00 (hora de Colombia).`
        });
        return;
      }
      if (isSupabaseConfigured()) {
        const supabaseDetail = await getPublicUnlockedDayFromSupabase(dayNumber, clock);
        if (supabaseDetail) {
          sendJson2(res, 200, supabaseDetail);
          return;
        }
      }
      const detail = {
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
          mimeType: asset.mimeType
        }))
      };
      sendJson2(res, 200, detail);
      return;
    }
    const assetMatch = pathname.match(/^\/api\/calendar\/(\d{1,2})\/asset\/([^/]+)$/);
    if (assetMatch && req.method === "GET") {
      const dayNumber = Number(assetMatch[1]);
      const rawFilename = decodeURIComponent(assetMatch[2]);
      const definition = getDayDefinition(dayNumber);
      if (!definition) {
        sendJson2(res, 404, { error: "D\xEDa inv\xE1lido." });
        return;
      }
      const state = getDayUnlockState(dayNumber, getBogotaClockSnapshot());
      if (state === "locked") {
        sendJson2(res, 403, { error: "Recurso a\xFAn bloqueado por fecha." });
        return;
      }
      const safeFilename = path2.basename(rawFilename);
      const declaredAsset = definition.mediaAssets?.find(
        (item) => item.filename === safeFilename
      );
      if (!declaredAsset) {
        sendJson2(res, 404, { error: "Recurso no registrado para este d\xEDa." });
        return;
      }
      const paddedDay = String(dayNumber).padStart(2, "0");
      const assetPath = path2.resolve(
        PRIVATE_CONTENT_DIR,
        `day-${paddedDay}`,
        safeFilename
      );
      if (!assetPath.startsWith(PRIVATE_CONTENT_DIR + path2.sep)) {
        sendJson2(res, 403, { error: "Ruta no permitida." });
        return;
      }
      try {
        const buffer = await fs.readFile(assetPath);
        setCommonSecurityHeaders(res);
        res.writeHead(200, {
          "Content-Type": declaredAsset.mimeType,
          "Cache-Control": "private, no-store"
        });
        res.end(buffer);
      } catch {
        sendJson2(res, 404, { error: "Archivo privado a\xFAn no disponible." });
      }
      return;
    }
  }
  sendJson2(res, 404, { error: "Ruta API no encontrada." });
}
async function serveStaticPublicFile(res, pathname) {
  const relativePath = pathname.replace(/^\/+/, "");
  const resolvedPath = path2.resolve(PUBLIC_DIR, relativePath);
  if (!resolvedPath.startsWith(PUBLIC_DIR + path2.sep)) {
    return false;
  }
  try {
    const stat = await fs.stat(resolvedPath);
    if (!stat.isFile()) return false;
    const ext = path2.extname(resolvedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
    const content = await fs.readFile(resolvedPath);
    setCommonSecurityHeaders(res);
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache"
    });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}
async function handleAppRequest(req, res) {
  try {
    const host = req.headers.host ?? `localhost:${PORT}`;
    const parsedUrl = new URL(req.url ?? "/", `http://${host}`);
    const { pathname, searchParams } = parsedUrl;
    if (pathname.startsWith("/api/admin")) {
      await handleAdminApiRequest(req, res, pathname);
      return;
    }
    if (pathname.startsWith("/api/")) {
      await handleApiRequest(req, res, pathname);
      return;
    }
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      const sessionUser = getAuthenticatedAdmin(req);
      const isAuthorized = sessionUser && isSupabaseConfigured() ? await verifyAdminAuthorizationInDb(sessionUser.uid, sessionUser.email) : false;
      const html = renderAdminHtmlShell({
        authenticated: Boolean(isAuthorized),
        user: isAuthorized ? sessionUser : null,
        supabaseStatus: getSupabaseStatusSummary(),
        bogotaDateLabel: getBogotaClockSnapshot().formattedDateEs
      });
      setCommonSecurityHeaders(res);
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store, no-cache, must-revalidate"
      });
      res.end(html);
      return;
    }
    if (pathname === "/calendario" || pathname.startsWith("/calendario/")) {
      const configured = isServerAuthConfigured();
      const authenticated = configured ? isRequestAuthenticated(req) : false;
      if (!authenticated) {
        setCommonSecurityHeaders(res);
        res.writeHead(302, {
          Location: "/?acceso=privado",
          "Cache-Control": "private, no-store"
        });
        res.end();
        return;
      }
      const html = renderHtmlShell({
        initialAuthenticated: true,
        initialServerConfigured: configured,
        initialStage: "calendar"
      });
      setCommonSecurityHeaders(res);
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store, no-cache, must-revalidate"
      });
      res.end(html);
      return;
    }
    if (pathname === "/") {
      const configured = isServerAuthConfigured();
      const authenticated = configured ? isRequestAuthenticated(req) : false;
      const requestedAccess = searchParams.has("acceso");
      const html = renderHtmlShell({
        initialAuthenticated: authenticated,
        initialServerConfigured: configured,
        initialStage: requestedAccess ? "access" : "hero"
      });
      setCommonSecurityHeaders(res);
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store, no-cache, must-revalidate"
      });
      res.end(html);
      return;
    }
    const served = await serveStaticPublicFile(res, pathname);
    if (served) return;
    setCommonSecurityHeaders(res);
    res.writeHead(302, { Location: "/" });
    res.end();
  } catch (error) {
    console.error("Error inesperado en el servidor:", error);
    if (!res.headersSent) {
      sendJson2(res, 500, { error: "Error interno del servidor." });
    }
  }
}
var server = http.createServer(handleAppRequest);
async function handler(req, res) {
  await handleAppRequest(req, res);
}
export {
  handler as default,
  handleAppRequest,
  server
};
