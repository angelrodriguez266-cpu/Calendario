export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const CONTENT_TYPE_LABELS = {
  letter: 'Carta',
  video: 'Video',
  audio: 'Audio',
  gallery: 'Fotografía o galería',
  coupon: 'Cupón o experiencia',
  special: 'Sorpresa especial',
};

export const STATUS_LABELS = {
  empty: 'Sin contenido',
  draft: 'Borrador',
  scheduled: 'Programado',
  published: 'Publicado',
};

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export async function adminFetchJson(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const payload = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: payload };
}

/**
 * Sube un archivo al servidor administrativo con progreso real de carga.
 */
export function uploadAdminFileWithProgress({
  file,
  dayNumber,
  mediaRole = 'primary',
  onProgress,
}) {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/files/upload', true);
    xhr.withCredentials = true;
    xhr.setRequestHeader('X-Day-Number', String(dayNumber));
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    xhr.setRequestHeader('X-Media-Role', mediaRole);
    xhr.setRequestHeader(
      'Content-Type',
      file.type || 'application/octet-stream'
    );

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onProgress === 'function') {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || '{}');
      } catch {
        data = {};
      }
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        data,
      });
    };

    xhr.onerror = () => {
      resolve({
        ok: false,
        status: 0,
        data: { error: 'Error de red durante la subida del archivo.' },
      });
    };

    xhr.send(file);
  });
}
