import crypto from 'node:crypto';
import path from 'node:path';
import type { MediaRole, StorageBucketName } from '../types/admin.ts';

export interface AllowedFileRule {
  mimeTypes: string[];
  extensions: string[];
  maxBytes: number;
  bucket: StorageBucketName;
  label: string;
}

export const FILE_RULES: Record<'image' | 'video' | 'audio' | 'pdf', AllowedFileRule> = {
  image: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    extensions: ['.jpg', '.jpeg', '.png', '.webp'],
    maxBytes: 15 * 1024 * 1024, // 15 MB
    bucket: 'surprise-media',
    label: 'Imagen (JPG, PNG, WEBP — máx. 15 MB)',
  },
  video: {
    mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
    extensions: ['.mp4', '.webm', '.mov'],
    maxBytes: 100 * 1024 * 1024, // 100 MB
    bucket: 'surprise-media',
    label: 'Video (MP4, WEBM, MOV — máx. 100 MB)',
  },
  audio: {
    mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a'],
    extensions: ['.mp3', '.wav', '.m4a'],
    maxBytes: 35 * 1024 * 1024, // 35 MB
    bucket: 'surprise-media',
    label: 'Audio (MP3, WAV, M4A — máx. 35 MB)',
  },
  pdf: {
    mimeTypes: ['application/pdf'],
    extensions: ['.pdf'],
    maxBytes: 25 * 1024 * 1024, // 25 MB
    bucket: 'surprise-documents',
    label: 'Documento PDF (máx. 25 MB)',
  },
};

const VALID_ROLES: Set<MediaRole> = new Set([
  'primary',
  'cover',
  'gallery_item',
  'attachment_image',
  'pdf_document',
  'extra',
]);

export function sanitizeMediaRole(raw: unknown): MediaRole {
  if (typeof raw === 'string' && VALID_ROLES.has(raw as MediaRole)) {
    return raw as MediaRole;
  }
  return 'primary';
}

export function validateUploadedFile(input: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): {
  ok: true;
  bucket: StorageBucketName;
  category: 'image' | 'video' | 'audio' | 'pdf';
  safeFileName: string;
} | {
  ok: false;
  error: string;
} {
  const cleanBase = path.basename(input.fileName || '').trim();
  if (!cleanBase) {
    return { ok: false, error: 'Nombre de archivo inválido.' };
  }

  const ext = path.extname(cleanBase).toLowerCase();
  const normalizedMime = (input.mimeType || '').split(';')[0].trim().toLowerCase();

  let matchedCategory: 'image' | 'video' | 'audio' | 'pdf' | null = null;
  for (const [category, rule] of Object.entries(FILE_RULES) as Array<
    ['image' | 'video' | 'audio' | 'pdf', AllowedFileRule]
  >) {
    if (
      rule.extensions.includes(ext) &&
      rule.mimeTypes.includes(normalizedMime)
    ) {
      matchedCategory = category;
      break;
    }
  }

  if (!matchedCategory) {
    return {
      ok: false,
      error: `Formato no permitido (${ext || 'sin extensión'} / ${normalizedMime || 'desconocido'}). Formatos admitidos: JPG, PNG, WEBP, MP4, WEBM, MP3, WAV, M4A y PDF.`,
    };
  }

  const rule = FILE_RULES[matchedCategory];
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, error: 'El archivo está vacío.' };
  }

  if (input.sizeBytes > rule.maxBytes) {
    const maxMb = Math.round(rule.maxBytes / (1024 * 1024));
    return {
      ok: false,
      error: `El archivo supera el límite máximo permitido de ${maxMb} MB para ${matchedCategory}.`,
    };
  }

  const safeStem = path
    .basename(cleanBase, ext)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'archivo';

  return {
    ok: true,
    bucket: rule.bucket,
    category: matchedCategory,
    safeFileName: `${safeStem}${ext}`,
  };
}

export function buildStorageObjectPath(dayNumber: number, safeFileName: string): string {
  const paddedDay = String(dayNumber).padStart(2, '0');
  const uniqueId = crypto.randomUUID().slice(0, 12);
  return `day-${paddedDay}/${uniqueId}-${safeFileName}`;
}
