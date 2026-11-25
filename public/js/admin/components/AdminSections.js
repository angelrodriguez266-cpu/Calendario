import { adminFetchJson, escapeHtml, formatBytes } from '../adminApi.js';
import { lucide } from '../lucideIcons.js';

export async function mountAdminMedia(container, { showToast, confirmDialog }) {
  container.innerHTML = `<div class="admin-panel"><p>Cargando biblioteca de archivos privados...</p></div>`;

  const res = await adminFetchJson('/api/admin/files');
  if (!res.ok) {
    container.innerHTML = `<div class="admin-alert admin-alert--error"><span>${lucide.alert}</span><span>${escapeHtml(res.data.error || 'Error al cargar archivos.')}</span></div>`;
    return;
  }

  let files = res.data.files || [];

  const render = () => {
    container.innerHTML = `
      <div class="admin-page-header">
        <div>
          <h1 class="admin-page-title">Archivos multimedia</h1>
          <p class="admin-page-subtitle">Todos los archivos se almacenan en buckets privados de Supabase Storage con enlaces firmados temporales.</p>
        </div>
      </div>

      ${
        files.length === 0
          ? `<div class="admin-panel"><p>Aún no has subido archivos multimedia. Puedes adjuntarlos desde el editor de cualquier día.</p></div>`
          : `
            <div class="file-cards-grid">
              ${files
                .map((f) => {
                  const isImg = (f.file_type || '').startsWith('image/');
                  const preview =
                    isImg && f.signed_url
                      ? `<img src="${escapeHtml(f.signed_url)}" alt="${escapeHtml(f.file_name)}" />`
                      : (f.file_type || '').startsWith('video/')
                        ? lucide.film
                        : (f.file_type || '').startsWith('audio/')
                          ? lucide.music
                          : lucide.fileText;

                  return `
                    <div class="file-card">
                      <div class="file-card__preview">${preview}</div>
                      <div class="file-card__body">
                        <div class="file-card__name" title="${escapeHtml(f.file_name)}">${escapeHtml(f.file_name)}</div>
                        <div class="file-card__meta">Día ${escapeHtml(f.day_number || '—')} · ${formatBytes(f.file_size)}</div>
                        <div class="file-card__meta">${escapeHtml(f.bucket_name)}</div>
                        <div style="display:flex;gap:0.45rem;margin-top:0.3rem;">
                          ${
                            f.signed_url
                              ? `<a href="${escapeHtml(f.signed_url)}" target="_blank" rel="noopener noreferrer" class="admin-btn admin-btn--secondary admin-btn--sm" style="flex:1;text-decoration:none;">Abrir</a>`
                              : ''
                          }
                          <button type="button" class="admin-btn admin-btn--danger admin-btn--sm" data-media-del="${escapeHtml(f.id)}">${lucide.trash}</button>
                        </div>
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          `
      }
    `;

    container.querySelectorAll('[data-media-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-media-del');
        if (!id) return;
        const ok = await confirmDialog({
          title: 'Eliminar archivo privado',
          message: 'Esta acción eliminará el archivo de Supabase Storage de manera definitiva.',
          confirmLabel: 'Eliminar',
        });
        if (!ok) return;

        const delRes = await adminFetchJson(`/api/admin/files/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        if (delRes.ok) {
          files = files.filter((item) => item.id !== id);
          showToast('Archivo eliminado correctamente');
          render();
        }
      });
    });
  };

  render();
}

export async function mountAdminCoupons(container, { onEditDay }) {
  const res = await adminFetchJson('/api/admin/calendar');
  const couponDays = (res.data?.days || []).filter(
    (d) => d.surprise?.content_type === 'coupon'
  );

  container.innerHTML = `
    <div class="admin-page-header">
      <div>
        <h1 class="admin-page-title">Cupones de experiencia</h1>
        <p class="admin-page-subtitle">Sección preparada para el sistema de selección de experiencias y emisión de cupones en PDF.</p>
      </div>
    </div>

    <div class="admin-panel">
      <div class="admin-panel__title"><span>Cupones configurados (${couponDays.length})</span></div>
      ${
        couponDays.length === 0
          ? `<p style="color:var(--negro-calido-80);">Todavía no has creado sorpresas de tipo «Cupón o experiencia». Puedes crearlas desde <strong>Crear sorpresa</strong> eligiendo el tipo Cupón.</p>`
          : `
            <div class="admin-days-list">
              ${couponDays
                .map(
                  (d) => `
                    <article class="admin-day-row">
                      <div class="admin-day-row__head">
                        <span class="admin-day-row__badge">Día ${d.day_number}</span>
                        <span class="status-pill status-pill--${d.display_status}">${d.display_status}</span>
                      </div>
                      <div class="admin-day-row__title">${escapeHtml(d.surprise.title)}</div>
                      <button type="button" class="admin-btn admin-btn--secondary admin-btn--sm" data-coupon-edit="${d.day_number}">
                        ${lucide.edit}<span>Editar cupón</span>
                      </button>
                    </article>
                  `
                )
                .join('')}
            </div>
          `
      }
    </div>
  `;

  container.querySelectorAll('[data-coupon-edit]').forEach((btn) => {
    btn.addEventListener('click', () => onEditDay(Number(btn.getAttribute('data-coupon-edit'))));
  });
}

export function mountAdminSettings(container, { user, supabaseStatus, bogotaDateLabel }) {
  container.innerHTML = `
    <div class="admin-page-header">
      <div>
        <h1 class="admin-page-title">Configuración y seguridad</h1>
        <p class="admin-page-subtitle">Estado del servidor, conexión con Supabase y zona horaria oficial.</p>
      </div>
    </div>

    <div class="admin-stats-grid">
      <div class="admin-stat-card">
        <span class="admin-stat-card__label"><span>Administrador activo</span>${lucide.lock}</span>
        <span class="admin-stat-card__value" style="font-size:1.08rem;word-break:break-all;">${escapeHtml(user?.email || '—')}</span>
        <span class="admin-stat-card__hint">Verificado vía Supabase Auth + admin_users</span>
      </div>

      <div class="admin-stat-card">
        <span class="admin-stat-card__label"><span>Estado Supabase</span>${lucide.check}</span>
        <span class="admin-stat-card__value" style="font-size:1.25rem;">${supabaseStatus.configured ? 'Conectado' : 'Pendiente'}</span>
        <span class="admin-stat-card__hint">RLS activo · Storage privado</span>
      </div>

      <div class="admin-stat-card">
        <span class="admin-stat-card__label"><span>Reloj oficial</span>${lucide.clock}</span>
        <span class="admin-stat-card__value" style="font-size:1.15rem;">America/Bogota</span>
        <span class="admin-stat-card__hint">${escapeHtml(bogotaDateLabel)}</span>
      </div>
    </div>

    <div class="admin-panel">
      <h2 class="admin-panel__title">Políticas de privacidad activas</h2>
      <ul style="padding-left:1.25rem;display:grid;gap:0.45rem;font-size:0.92rem;color:var(--negro-calido-80);">
        <li>Las claves secretas (<code>SUPABASE_SERVICE_ROLE_KEY</code>) nunca se envían al navegador.</li>
        <li>Los buckets <code>surprise-media</code> y <code>surprise-documents</code> son estrictamente privados y usan URLs firmadas temporales.</li>
        <li>María solo recibe sorpresas con estado <code>scheduled</code> o <code>published</code> cuya fecha <code>unlock_at</code> ya se haya cumplido en <code>America/Bogota</code>.</li>
        <li>La autorización administrativa se valida en base de datos (<code>public.admin_users</code>), nunca en <code>user_metadata</code>.</li>
      </ul>
    </div>
  `;
}
