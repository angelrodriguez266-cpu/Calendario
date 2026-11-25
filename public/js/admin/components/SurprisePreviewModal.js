import { escapeHtml } from '../adminApi.js';
import { lucide } from '../lucideIcons.js';

/**
 * Vista previa fiel al diseño público de María (sin publicar ni desbloquear).
 */
export function openSurprisePreviewModal({
  dayNumber,
  title,
  subtitle,
  description,
  contentType,
  contentData = {},
  files = [],
}) {
  const existing = document.getElementById('admin-preview-modal-root');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'admin-preview-modal-root';
  overlay.className = 'admin-modal-backdrop';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const isSpecialDark =
    contentType === 'special' && contentData.highlightStyle === 'night';

  const bodyText =
    contentType === 'letter' && contentData.letterBody
      ? String(contentData.letterBody)
      : description || '';

  const paragraphsHtml = bodyText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="font-size:1rem;line-height:1.75;margin-bottom:0.85rem;">${escapeHtml(p)}</p>`
    )
    .join('');

  const mediaHtml = (files || [])
    .map((file) => {
      const url = file.signed_url || file.previewUrl || '';
      if (!url) return '';
      if ((file.file_type || '').startsWith('image/')) {
        return `<figure style="margin:0.85rem 0;border-radius:10px;overflow:hidden;border:1px solid var(--oro-champan-55);"><img src="${escapeHtml(url)}" alt="${escapeHtml(file.file_name)}" style="width:100%;max-height:360px;object-fit:cover;display:block;" /></figure>`;
      }
      if ((file.file_type || '').startsWith('video/')) {
        return `<div style="margin:0.85rem 0;border-radius:10px;overflow:hidden;border:1px solid var(--oro-champan-55);"><video controls style="width:100%;display:block;max-height:360px;"><source src="${escapeHtml(url)}" type="${escapeHtml(file.file_type)}" /></video></div>`;
      }
      if ((file.file_type || '').startsWith('audio/')) {
        return `<div style="margin:0.85rem 0;padding:0.8rem;border-radius:10px;background:rgba(38,59,50,0.08);border:1px solid rgba(38,59,50,0.2);"><audio controls style="width:100%;"><source src="${escapeHtml(url)}" type="${escapeHtml(file.file_type)}" /></audio></div>`;
      }
      if (file.file_type === 'application/pdf') {
        return `<div style="margin:0.85rem 0;"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="admin-btn admin-btn--primary admin-btn--sm">${lucide.fileText}<span>Descargar ${escapeHtml(file.file_name)}</span></a></div>`;
      }
      return '';
    })
    .join('');

  const couponOptions =
    contentType === 'coupon' && Array.isArray(contentData.options)
      ? `<div style="display:grid;gap:0.55rem;margin-top:0.85rem;">
          ${contentData.options
            .map(
              (opt) =>
                `<div style="padding:0.7rem 1rem;border-radius:8px;border:1px solid var(--oro-champan-85);background:rgba(243,235,221,0.75);font-weight:500;">${escapeHtml(opt)}</div>`
            )
            .join('')}
        </div>`
      : '';

  const signatureHtml =
    contentType === 'letter' && contentData.signature
      ? `<p style="font-family:var(--font-script);font-size:2.1rem;color:var(--color-borgona);text-align:right;margin-top:1rem;">${escapeHtml(contentData.signature)}</p>`
      : '';

  overlay.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:0.85rem;width:100%;max-height:94vh;">
      <div style="display:flex;align-items:center;gap:0.6rem;background:rgba(41,39,36,0.9);padding:0.45rem 0.9rem;border-radius:999px;border:1px solid var(--oro-champan-85);color:var(--color-marfil);font-size:0.82rem;">
        <span>Vista previa para María (sin publicar)</span>
        <button type="button" id="preview-mode-desktop" class="admin-btn admin-btn--sm admin-btn--primary">Escritorio</button>
        <button type="button" id="preview-mode-mobile" class="admin-btn admin-btn--sm admin-btn--secondary">Móvil</button>
        <button type="button" id="preview-close-top" class="admin-btn admin-btn--sm admin-btn--secondary" aria-label="Cerrar vista previa">${lucide.x}</button>
      </div>

      <article
        id="preview-card-frame"
        class="admin-modal ${isSpecialDark ? '' : 'ivory-paper-surface'}"
        style="${isSpecialDark ? 'background:linear-gradient(155deg,#263B32,#292724);color:#F3EBDD;' : ''}"
      >
        <div style="display:flex;align-items:center;justify-content:space-between;gap:0.8rem;margin-bottom:1.25rem;">
          <span style="padding:0.35rem 1rem;background:var(--color-borgona);color:var(--color-marfil);font-family:var(--font-serif);font-style:italic;border-radius:4px;">Día ${escapeHtml(dayNumber)}</span>
          <span style="font-size:0.84rem;opacity:0.72;">${escapeHtml(dayNumber)} de diciembre de 2026</span>
        </div>

        <h2 style="font-family:var(--font-serif);font-style:italic;font-size:clamp(1.55rem,3vw,2.1rem);color:${isSpecialDark ? '#C6A46F' : 'var(--color-borgona)'};margin-bottom:0.45rem;">
          ${escapeHtml(title || `Sorpresa del Día ${dayNumber}`)}
        </h2>
        ${
          subtitle
            ? `<p style="font-size:0.95rem;color:${isSpecialDark ? '#F3EBDD' : 'var(--color-verde-noche)'};margin-bottom:1rem;opacity:0.9;">${escapeHtml(subtitle)}</p>`
            : ''
        }

        <div>${paragraphsHtml || '<p style="opacity:0.68;font-style:italic;">Agrega un texto o dedicatoria para visualizarlo aquí.</p>'}</div>
        ${mediaHtml}
        ${couponOptions}
        ${signatureHtml}
      </article>
    </div>
  `;

  document.body.appendChild(overlay);

  const frame = overlay.querySelector('#preview-card-frame');
  const close = () => {
    overlay.remove();
    window.removeEventListener('keydown', onEsc);
  };
  const onEsc = (e) => {
    if (e.key === 'Escape') close();
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('#preview-close-top')?.addEventListener('click', close);
  overlay.querySelector('#preview-mode-desktop')?.addEventListener('click', () => {
    frame?.classList.remove('admin-modal--mobile-sim');
  });
  overlay.querySelector('#preview-mode-mobile')?.addEventListener('click', () => {
    frame?.classList.add('admin-modal--mobile-sim');
  });
  window.addEventListener('keydown', onEsc);
}
