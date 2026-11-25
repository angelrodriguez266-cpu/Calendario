import {
  adminFetchJson,
  CONTENT_TYPE_LABELS,
  escapeHtml,
  STATUS_LABELS,
} from '../adminApi.js';
import { lucide } from '../lucideIcons.js';
import { openSurprisePreviewModal } from './SurprisePreviewModal.js';

export async function mountAdminDashboard(container, { onEditDay, onNavigate }) {
  container.innerHTML = `<div class="admin-panel"><p>Cargando resumen del calendario...</p></div>`;

  const res = await adminFetchJson('/api/admin/dashboard');
  if (!res.ok) {
    container.innerHTML = `<div class="admin-alert admin-alert--error"><span>${lucide.alert}</span><span>${escapeHtml(res.data.error || 'Error al cargar el dashboard.')}</span></div>`;
    return;
  }

  const { stats, days, clock } = res.data;

  const nextPubLabel = stats.nextPublication
    ? `Día ${stats.nextPublication.day_number} · ${escapeHtml(stats.nextPublication.title)}`
    : 'Ninguna programada aún';

  container.innerHTML = `
    <div class="admin-page-header">
      <div>
        <h1 class="admin-page-title">Bienvenido, Ángel</h1>
        <p class="admin-page-subtitle">Resumen de diciembre 2026 · Hora oficial en Colombia: ${escapeHtml(clock.formattedDateEs)}</p>
      </div>
      <button type="button" id="dash-create-btn" class="admin-btn admin-btn--primary">
        ${lucide.plusCircle}
        <span>Crear sorpresa</span>
      </button>
    </div>

    <div class="admin-stats-grid">
      <div class="admin-stat-card">
        <span class="admin-stat-card__label"><span>Total de días</span>${lucide.calendar}</span>
        <span class="admin-stat-card__value">${stats.totalDays}</span>
        <span class="admin-stat-card__hint">1 al 31 de diciembre 2026</span>
      </div>

      <div class="admin-stat-card">
        <span class="admin-stat-card__label"><span>Sorpresas creadas</span>${lucide.sparkles}</span>
        <span class="admin-stat-card__value">${stats.createdCount}</span>
        <span class="admin-stat-card__hint">${stats.scheduledCount} programadas · ${stats.draftCount} borradores</span>
      </div>

      <div class="admin-stat-card">
        <span class="admin-stat-card__label"><span>Días publicados</span>${lucide.check}</span>
        <span class="admin-stat-card__value">${stats.publishedCount}</span>
        <span class="admin-stat-card__hint">Listos para su fecha</span>
      </div>

      <div class="admin-stat-card">
        <span class="admin-stat-card__label"><span>Pendientes</span>${lucide.clock}</span>
        <span class="admin-stat-card__value">${stats.pendingCount}</span>
        <span class="admin-stat-card__hint">Días sin contenido asignado</span>
      </div>

      <div class="admin-stat-card">
        <span class="admin-stat-card__label"><span>Próxima publicación</span>${lucide.calendar}</span>
        <span class="admin-stat-card__value" style="font-size:1.25rem;">${stats.nextPublication ? `Dic ${stats.nextPublication.day_number}` : '—'}</span>
        <span class="admin-stat-card__hint">${nextPubLabel}</span>
      </div>
    </div>

    <section class="admin-panel">
      <div class="admin-panel__title">
        <span>Vista rápida de diciembre 2026 (31 días)</span>
        <button type="button" id="dash-open-calendar-btn" class="admin-btn admin-btn--secondary admin-btn--sm">Ver gestión completa</button>
      </div>

      <div class="admin-mini-grid">
        ${days
          .map(
            (d) => `
              <button type="button" class="admin-mini-day" data-mini-day="${d.day_number}" title="Día ${d.day_number}: ${STATUS_LABELS[d.display_status]}">
                <span class="admin-mini-day__num">${d.day_number}</span>
                <span class="admin-mini-day__dot dot--${d.display_status}"></span>
              </button>
            `
          )
          .join('')}
      </div>
    </section>
  `;

  container.querySelector('#dash-create-btn')?.addEventListener('click', () => onNavigate('create'));
  container.querySelector('#dash-open-calendar-btn')?.addEventListener('click', () => onNavigate('calendar'));
  container.querySelectorAll('[data-mini-day]').forEach((btn) => {
    btn.addEventListener('click', () => {
      onEditDay(Number(btn.getAttribute('data-mini-day')));
    });
  });
}

export async function mountAdminCalendarManager(
  container,
  { onEditDay, showToast, confirmDialog }
) {
  container.innerHTML = `<div class="admin-panel"><p>Cargando los 31 días de diciembre...</p></div>`;

  const res = await adminFetchJson('/api/admin/calendar');
  if (!res.ok) {
    container.innerHTML = `<div class="admin-alert admin-alert--error"><span>${lucide.alert}</span><span>${escapeHtml(res.data.error || 'Error al cargar calendario.')}</span></div>`;
    return;
  }

  let allDays = res.data.days || [];
  let searchQuery = '';
  let statusFilter = 'all';
  let typeFilter = 'all';

  const renderGrid = () => {
    const filtered = allDays.filter((item) => {
      if (statusFilter !== 'all' && item.display_status !== statusFilter) return false;
      if (typeFilter !== 'all' && item.surprise?.content_type !== typeFilter) return false;
      if (searchQuery) {
        const haystack = `${item.day_number} ${item.date_label} ${item.surprise?.title || ''}`.toLowerCase();
        if (!haystack.includes(searchQuery)) return false;
      }
      return true;
    });

    const listSlot = container.querySelector('#admin-days-list-slot');
    if (!listSlot) return;

    if (filtered.length === 0) {
      listSlot.innerHTML = `<div class="admin-panel"><p>No hay días que coincidan con los filtros actuales.</p></div>`;
      return;
    }

    listSlot.innerHTML = `
      <div class="admin-days-list">
        ${filtered
          .map((item) => {
            const s = item.surprise;
            const typeLabel = s ? CONTENT_TYPE_LABELS[s.content_type] || s.content_type : 'Sin tipo';
            return `
              <article class="admin-day-row">
                <div class="admin-day-row__head">
                  <div>
                    <div class="admin-day-row__badge">Día ${item.day_number}</div>
                    <div class="admin-day-row__date">${escapeHtml(item.date_label)}</div>
                  </div>
                  <span class="status-pill status-pill--${item.display_status}">
                    ${STATUS_LABELS[item.display_status]}
                  </span>
                </div>

                <div class="admin-day-row__title">
                  ${s ? escapeHtml(s.title) : '<span style="opacity:0.58;font-style:italic;">Sorpresa pendiente de crear</span>'}
                </div>

                <div class="admin-day-row__meta">
                  <span>${typeLabel}</span>
                  ${
                    s && s.files_count > 0
                      ? `<span style="display:inline-flex;align-items:center;gap:0.25rem;">${lucide.paperclip} ${s.files_count} archivo(s)</span>`
                      : ''
                  }
                </div>

                <div class="admin-day-row__actions">
                  <button type="button" class="admin-btn admin-btn--primary admin-btn--sm" data-cal-edit="${item.day_number}">
                    ${lucide.edit}
                    <span>${s ? 'Editar' : 'Crear'}</span>
                  </button>
                  ${
                    s
                      ? `
                        <button type="button" class="admin-btn admin-btn--secondary admin-btn--sm" data-cal-preview="${item.day_number}">
                          ${lucide.eye}
                          <span>Vista previa</span>
                        </button>
                        <button type="button" class="admin-btn admin-btn--danger admin-btn--sm" data-cal-delete="${item.day_number}" aria-label="Eliminar sorpresa del día ${item.day_number}">
                          ${lucide.trash}
                        </button>
                      `
                      : ''
                  }
                </div>
              </article>
            `;
          })
          .join('')}
      </div>
    `;

    listSlot.querySelectorAll('[data-cal-edit]').forEach((btn) => {
      btn.addEventListener('click', () => onEditDay(Number(btn.getAttribute('data-cal-edit'))));
    });

    listSlot.querySelectorAll('[data-cal-preview]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const dayNum = Number(btn.getAttribute('data-cal-preview'));
        const detail = await adminFetchJson(`/api/admin/surprises/${dayNum}`);
        if (detail.ok && detail.data.surprise) {
          openSurprisePreviewModal({
            dayNumber: dayNum,
            title: detail.data.surprise.title,
            subtitle: detail.data.surprise.subtitle,
            description: detail.data.surprise.description,
            contentType: detail.data.surprise.content_type,
            contentData: detail.data.surprise.content_data,
            files: detail.data.files || [],
          });
        }
      });
    });

    listSlot.querySelectorAll('[data-cal-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const dayNum = Number(btn.getAttribute('data-cal-delete'));
        const ok = await confirmDialog({
          title: `Eliminar sorpresa del Día ${dayNum}`,
          message: 'Se eliminará la sorpresa y todos sus archivos adjuntos en Storage.',
          confirmLabel: 'Eliminar',
        });
        if (!ok) return;

        const delRes = await adminFetchJson(`/api/admin/surprises/${dayNum}`, { method: 'DELETE' });
        if (delRes.ok) {
          showToast(`Día ${dayNum} limpiado correctamente`);
          const refresh = await adminFetchJson('/api/admin/calendar');
          if (refresh.ok) {
            allDays = refresh.data.days || [];
            renderGrid();
          }
        }
      });
    });
  };

  container.innerHTML = `
    <div class="admin-page-header">
      <div>
        <h1 class="admin-page-title">Gestión del Calendario</h1>
        <p class="admin-page-subtitle">Administra los 31 días de diciembre de 2026 en orden cronológico.</p>
      </div>
    </div>

    <div class="admin-filters-bar">
      <div class="admin-input-wrap">
        ${lucide.search}
        <input id="cal-search-input" type="search" class="admin-input" placeholder="Buscar por título o número de día..." />
      </div>

      <select id="cal-status-filter" class="admin-select" aria-label="Filtrar por estado">
        <option value="all">Todos los estados</option>
        <option value="empty">Sin contenido</option>
        <option value="draft">Borrador</option>
        <option value="scheduled">Programado</option>
        <option value="published">Publicado</option>
      </select>

      <select id="cal-type-filter" class="admin-select" aria-label="Filtrar por tipo de contenido">
        <option value="all">Todos los tipos</option>
        ${Object.entries(CONTENT_TYPE_LABELS)
          .map(([k, label]) => `<option value="${k}">${label}</option>`)
          .join('')}
      </select>
    </div>

    <div id="admin-days-list-slot"></div>
  `;

  container.querySelector('#cal-search-input')?.addEventListener('input', (e) => {
    searchQuery = /** @type {HTMLInputElement} */ (e.target).value.trim().toLowerCase();
    renderGrid();
  });
  container.querySelector('#cal-status-filter')?.addEventListener('change', (e) => {
    statusFilter = /** @type {HTMLSelectElement} */ (e.target).value;
    renderGrid();
  });
  container.querySelector('#cal-type-filter')?.addEventListener('change', (e) => {
    typeFilter = /** @type {HTMLSelectElement} */ (e.target).value;
    renderGrid();
  });

  renderGrid();
}
