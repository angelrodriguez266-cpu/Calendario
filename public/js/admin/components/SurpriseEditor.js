import {
  adminFetchJson,
  CONTENT_TYPE_LABELS,
  escapeHtml,
  formatBytes,
  uploadAdminFileWithProgress,
} from '../adminApi.js';
import { lucide } from '../lucideIcons.js';
import { openSurprisePreviewModal } from './SurprisePreviewModal.js';

function isoToBogotaDatetimeLocal(isoString, dayNumber) {
  if (!isoString) {
    return `2026-12-${String(dayNumber).padStart(2, '0')}T00:00`;
  }
  try {
    const d = new Date(isoString);
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(d).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value])
    );
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  } catch {
    return `2026-12-${String(dayNumber).padStart(2, '0')}T00:00`;
  }
}

export async function mountSurpriseEditor(
  container,
  { dayNumber = 1, onSaved, onDeleted, onDayChange, showToast, confirmDialog }
) {
  container.innerHTML = `<div class="admin-panel"><p>Cargando editor del Día ${dayNumber}...</p></div>`;

  const detailRes = await adminFetchJson(`/api/admin/surprises/${dayNumber}`);
  if (!detailRes.ok) {
    container.innerHTML = `
      <div class="admin-alert admin-alert--error">
        <span>${lucide.alert}</span>
        <span>${escapeHtml(detailRes.data.error || 'No se pudo cargar este día.')}</span>
      </div>
    `;
    return () => {};
  }

  const initialDay = detailRes.data.day;
  const initialSurprise = detailRes.data.surprise;
  let currentFiles = Array.isArray(detailRes.data.files) ? [...detailRes.data.files] : [];

  const formState = {
    dayNumber,
    unlockLocal: isoToBogotaDatetimeLocal(initialDay?.unlock_at, dayNumber),
    title: initialSurprise?.title || '',
    subtitle: initialSurprise?.subtitle || '',
    description: initialSurprise?.description || '',
    contentType: initialSurprise?.content_type || 'letter',
    status: initialSurprise?.status || 'draft',
    contentData: { ...(initialSurprise?.content_data || {}) },
    autosaveEnabled: false,
  };

  let autosaveTimer = null;

  const renderDynamicTypeFields = () => {
    const d = formState.contentData;
    switch (formState.contentType) {
      case 'letter':
        return `
          <div class="admin-field editor-grid__full">
            <label for="ed-letter-body" class="admin-label">Texto completo de la carta</label>
            <textarea id="ed-letter-body" class="admin-textarea" style="min-height:170px;" placeholder="Escribe tu carta para María...">${escapeHtml(d.letterBody || '')}</textarea>
          </div>
          <div class="admin-field editor-grid__full">
            <label for="ed-letter-signature" class="admin-label">Firma</label>
            <input id="ed-letter-signature" type="text" class="admin-input" placeholder="Con todo mi cariño, Ángel" value="${escapeHtml(d.signature || '')}" />
          </div>
        `;
      case 'video':
        return `
          <div class="admin-alert admin-alert--warning editor-grid__full">
            <span>${lucide.film}</span>
            <span>Adjunta abajo tu archivo de video (MP4/WEBM) y, si deseas, una imagen de portada (rol: Portada).</span>
          </div>
        `;
      case 'audio':
        return `
          <div class="admin-alert admin-alert--warning editor-grid__full">
            <span>${lucide.music}</span>
            <span>Adjunta abajo tu archivo de audio (MP3, WAV o M4A) y opcionalmente una imagen asociada.</span>
          </div>
        `;
      case 'gallery':
        return `
          <div class="admin-alert admin-alert--warning editor-grid__full">
            <span>${lucide.image}</span>
            <span>Puedes subir una o varias fotografías (JPG, PNG, WEBP) arrastrándolas juntas a la zona de carga.</span>
          </div>
        `;
      case 'coupon': {
        const optionsText = Array.isArray(d.options) ? d.options.join('\n') : '';
        return `
          <div class="admin-field editor-grid__full">
            <label for="ed-coupon-options" class="admin-label">Opciones disponibles (una por línea)</label>
            <textarea id="ed-coupon-options" class="admin-textarea" placeholder="Cena especial juntos&#10;Noche de película y snacks&#10;Día de aventura">${escapeHtml(optionsText)}</textarea>
          </div>
          <div class="admin-field editor-grid__full">
            <label for="ed-coupon-redemption" class="admin-label">Nota para selección y futura emisión de PDF</label>
            <input id="ed-coupon-redemption" type="text" class="admin-input" placeholder="Válido para redimir cuando tú elijas" value="${escapeHtml(d.redemptionNote || '')}" />
          </div>
        `;
      }
      case 'special':
      default:
        return `
          <div class="admin-field editor-grid__full">
            <label for="ed-special-style" class="admin-label">Estilo destacado</label>
            <select id="ed-special-style" class="admin-select">
              <option value="gold" ${d.highlightStyle !== 'night' ? 'selected' : ''}>Destacado editorial marfil y oro</option>
              <option value="night" ${d.highlightStyle === 'night' ? 'selected' : ''}>Noche navideña (verde noche y oro champán)</option>
            </select>
          </div>
        `;
    }
  };

  const renderFilesGrid = () => {
    if (currentFiles.length === 0) {
      return `<p style="font-size:0.86rem;color:var(--negro-calido-62);">Aún no hay archivos adjuntos para este día.</p>`;
    }
    return `
      <div class="file-cards-grid">
        ${currentFiles
          .map((file) => {
            const isImg = (file.file_type || '').startsWith('image/');
            const isVid = (file.file_type || '').startsWith('video/');
            const isAud = (file.file_type || '').startsWith('audio/');
            const preview = isImg && file.signed_url
              ? `<img src="${escapeHtml(file.signed_url)}" alt="${escapeHtml(file.file_name)}" />`
              : isVid
                ? lucide.film
                : isAud
                  ? lucide.music
                  : lucide.fileText;

            return `
              <div class="file-card" data-file-card="${escapeHtml(file.id)}">
                <div class="file-card__preview">${preview}</div>
                <div class="file-card__body">
                  <div class="file-card__name" title="${escapeHtml(file.file_name)}">${escapeHtml(file.file_name)}</div>
                  <div class="file-card__meta">${escapeHtml(file.media_role)} · ${formatBytes(file.file_size)}</div>
                  <div style="display:flex;gap:0.4rem;margin-top:0.25rem;">
                    ${
                      file.signed_url
                        ? `<a href="${escapeHtml(file.signed_url)}" target="_blank" rel="noopener noreferrer" class="admin-btn admin-btn--secondary admin-btn--sm" style="flex:1;text-decoration:none;">Ver</a>`
                        : ''
                    }
                    <button type="button" class="admin-btn admin-btn--danger admin-btn--sm" data-delete-file="${escapeHtml(file.id)}" aria-label="Eliminar archivo">
                      ${lucide.trash}
                    </button>
                  </div>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  };

  const renderEditor = () => {
    const dayOptions = Array.from({ length: 31 }, (_, i) => {
      const n = i + 1;
      return `<option value="${n}" ${n === formState.dayNumber ? 'selected' : ''}>Día ${n} — ${n} de diciembre de 2026</option>`;
    }).join('');

    const typeOptions = Object.entries(CONTENT_TYPE_LABELS)
      .map(
        ([k, label]) =>
          `<option value="${k}" ${k === formState.contentType ? 'selected' : ''}>${label}</option>`
      )
      .join('');

    container.innerHTML = `
      <div class="admin-page-header">
        <div>
          <h1 class="admin-page-title">${initialSurprise ? `Editar Día ${formState.dayNumber}` : `Crear sorpresa — Día ${formState.dayNumber}`}</h1>
          <p class="admin-page-subtitle">La publicación es independiente del desbloqueo automático a las 00:00 (America/Bogota).</p>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:0.6rem;">
          <button type="button" id="ed-preview-btn" class="admin-btn admin-btn--secondary">
            ${lucide.eye}
            <span>Vista previa</span>
          </button>
          ${
            initialSurprise
              ? `<button type="button" id="ed-delete-btn" class="admin-btn admin-btn--danger">${lucide.trash}<span>Eliminar</span></button>`
              : ''
          }
        </div>
      </div>

      <form id="surprise-editor-form" style="display:flex;flex-direction:column;gap:1.2rem;" novalidate>
        <div id="editor-validation-alert" class="admin-alert admin-alert--error" role="alert" hidden></div>

        <!-- Información general -->
        <section class="editor-section">
          <h2 class="editor-section__heading">Información general</h2>
          <div class="editor-grid">
            <div class="admin-field">
              <label for="ed-day-select" class="admin-label">Día del calendario (1–31)</label>
              <select id="ed-day-select" class="admin-select">${dayOptions}</select>
            </div>

            <div class="admin-field">
              <label for="ed-unlock-at" class="admin-label">Fecha y hora de desbloqueo (Colombia)</label>
              <input id="ed-unlock-at" type="datetime-local" class="admin-input" value="${escapeHtml(formState.unlockLocal)}" />
            </div>

            <div class="admin-field">
              <label for="ed-content-type" class="admin-label">Tipo de contenido</label>
              <select id="ed-content-type" class="admin-select">${typeOptions}</select>
            </div>

            <div class="admin-field">
              <label for="ed-status" class="admin-label">Estado de publicación</label>
              <select id="ed-status" class="admin-select">
                <option value="draft" ${formState.status === 'draft' ? 'selected' : ''}>Borrador</option>
                <option value="scheduled" ${formState.status === 'scheduled' ? 'selected' : ''}>Programado</option>
                <option value="published" ${formState.status === 'published' ? 'selected' : ''}>Publicado</option>
              </select>
            </div>

            <div class="admin-field editor-grid__full">
              <label for="ed-title" class="admin-label">Título de la sorpresa *</label>
              <input id="ed-title" type="text" class="admin-input" required placeholder="Ej: Una razón más para sonreír contigo" value="${escapeHtml(formState.title)}" />
            </div>

            <div class="admin-field editor-grid__full">
              <label for="ed-subtitle" class="admin-label">Subtítulo (opcional)</label>
              <input id="ed-subtitle" type="text" class="admin-input" placeholder="Pequeño subtítulo o contexto" value="${escapeHtml(formState.subtitle)}" />
            </div>

            <div class="admin-field editor-grid__full">
              <label for="ed-description" class="admin-label">Descripción o dedicatoria</label>
              <textarea id="ed-description" class="admin-textarea" placeholder="Escribe una dedicatoria especial...">${escapeHtml(formState.description)}</textarea>
            </div>
          </div>
        </section>

        <!-- Campos dinámicos según el tipo -->
        <section class="editor-section">
          <h2 class="editor-section__heading">Detalles de ${CONTENT_TYPE_LABELS[formState.contentType]}</h2>
          <div class="editor-grid" id="dynamic-type-fields">
            ${renderDynamicTypeFields()}
          </div>
        </section>

        <!-- Archivos adjuntos privados (Supabase Storage) -->
        <section class="editor-section">
          <h2 class="editor-section__heading">Archivos adjuntos privados</h2>

          <div class="editor-grid">
            <div class="admin-field">
              <label for="ed-media-role" class="admin-label">Rol del archivo a subir</label>
              <select id="ed-media-role" class="admin-select">
                <option value="primary">Archivo principal</option>
                <option value="cover">Imagen de portada</option>
                <option value="gallery_item">Fotografía de galería</option>
                <option value="attachment_image">Fotografía opcional</option>
                <option value="pdf_document">Documento PDF</option>
                <option value="extra">Recurso adicional</option>
              </select>
            </div>
          </div>

          <div class="dropzone" id="file-dropzone" tabindex="0" role="button" aria-label="Seleccionar o arrastrar archivos">
            ${lucide.upload}
            <strong>Arrastra y suelta tus archivos aquí o haz clic para seleccionarlos</strong>
            <span style="font-size:0.8rem;color:var(--negro-calido-62);">
              JPG, PNG, WEBP (máx. 15 MB) · MP4, WEBM (máx. 100 MB) · MP3, WAV, M4A (máx. 35 MB) · PDF (máx. 25 MB)
            </span>
            <input id="file-input-hidden" type="file" multiple hidden accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.mov,.mp3,.wav,.m4a,.pdf" />
          </div>

          <div id="upload-progress-wrap" hidden style="display:flex;flex-direction:column;gap:0.35rem;">
            <span id="upload-progress-label" style="font-size:0.82rem;color:var(--color-verde-noche);">Subiendo...</span>
            <div class="upload-progress"><div id="upload-progress-bar" class="upload-progress__bar" style="width:0%;"></div></div>
          </div>

          <div id="upload-error-box" class="admin-alert admin-alert--error" hidden></div>

          <div id="uploaded-files-container">
            ${renderFilesGrid()}
          </div>
        </section>

        <!-- Barra inferior de guardado -->
        <div class="admin-panel" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem;">
          <label style="display:inline-flex;align-items:center;gap:0.5rem;font-size:0.86rem;cursor:pointer;">
            <input type="checkbox" id="ed-autosave-toggle" ${formState.autosaveEnabled ? 'checked' : ''} />
            <span>Autoguardado opcional de borradores</span>
          </label>

          <div style="display:flex;flex-wrap:wrap;gap:0.65rem;">
            <button type="button" id="ed-save-draft-btn" class="admin-btn admin-btn--secondary">
              ${lucide.save}
              <span>Guardar borrador</span>
            </button>
            <button type="submit" id="ed-save-main-btn" class="admin-btn admin-btn--primary">
              ${lucide.check}
              <span>Guardar sorpresa</span>
            </button>
          </div>
        </div>
      </form>
    `;

    bindEditorEvents();
  };

  const syncFormStateFromDom = () => {
    const titleEl = /** @type {HTMLInputElement | null} */ (container.querySelector('#ed-title'));
    const subEl = /** @type {HTMLInputElement | null} */ (container.querySelector('#ed-subtitle'));
    const descEl = /** @type {HTMLTextAreaElement | null} */ (container.querySelector('#ed-description'));
    const statusEl = /** @type {HTMLSelectElement | null} */ (container.querySelector('#ed-status'));
    const unlockEl = /** @type {HTMLInputElement | null} */ (container.querySelector('#ed-unlock-at'));

    if (titleEl) formState.title = titleEl.value;
    if (subEl) formState.subtitle = subEl.value;
    if (descEl) formState.description = descEl.value;
    if (statusEl) formState.status = statusEl.value;
    if (unlockEl) formState.unlockLocal = unlockEl.value;

    if (formState.contentType === 'letter') {
      const bodyEl = /** @type {HTMLTextAreaElement | null} */ (container.querySelector('#ed-letter-body'));
      const sigEl = /** @type {HTMLInputElement | null} */ (container.querySelector('#ed-letter-signature'));
      formState.contentData.letterBody = bodyEl?.value || '';
      formState.contentData.signature = sigEl?.value || '';
    } else if (formState.contentType === 'coupon') {
      const optEl = /** @type {HTMLTextAreaElement | null} */ (container.querySelector('#ed-coupon-options'));
      const redEl = /** @type {HTMLInputElement | null} */ (container.querySelector('#ed-coupon-redemption'));
      formState.contentData.options = (optEl?.value || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      formState.contentData.redemptionNote = redEl?.value || '';
    } else if (formState.contentType === 'special') {
      const styleEl = /** @type {HTMLSelectElement | null} */ (container.querySelector('#ed-special-style'));
      formState.contentData.highlightStyle = styleEl?.value || 'gold';
    }
  };

  const persistSurprise = async (overrideStatus = null, silentAutosave = false) => {
    syncFormStateFromDom();
    const alertBox = /** @type {HTMLElement | null} */ (container.querySelector('#editor-validation-alert'));

    if (!formState.title.trim()) {
      if (!silentAutosave && alertBox) {
        alertBox.innerHTML = `<span>${lucide.alert}</span><span>El título de la sorpresa es obligatorio antes de guardar.</span>`;
        alertBox.hidden = false;
      }
      return false;
    }

    if (alertBox) alertBox.hidden = true;

    const unlockIso = formState.unlockLocal
      ? `${formState.unlockLocal}:00-05:00`
      : `2026-12-${String(formState.dayNumber).padStart(2, '0')}T00:00:00-05:00`;

    const res = await adminFetchJson(`/api/admin/surprises/${formState.dayNumber}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: formState.title.trim(),
        subtitle: formState.subtitle.trim() || null,
        description: formState.description.trim() || null,
        content_type: formState.contentType,
        content_data: formState.contentData,
        status: overrideStatus || formState.status,
        unlock_at: unlockIso,
      }),
    });

    if (!res.ok) {
      if (!silentAutosave && alertBox) {
        alertBox.innerHTML = `<span>${lucide.alert}</span><span>${escapeHtml(res.data.error || 'No se pudo guardar la sorpresa.')}</span>`;
        alertBox.hidden = false;
      }
      return false;
    }

    if (overrideStatus) {
      formState.status = overrideStatus;
    }
    showToast(
      silentAutosave
        ? `Borrador del Día ${formState.dayNumber} autoguardado`
        : `Sorpresa del Día ${formState.dayNumber} guardada correctamente`
    );
    if (!silentAutosave && typeof onSaved === 'function') {
      onSaved(res.data);
    }
    return true;
  };

  const handleFilesSelected = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const roleEl = /** @type {HTMLSelectElement | null} */ (container.querySelector('#ed-media-role'));
    const progressWrap = /** @type {HTMLElement | null} */ (container.querySelector('#upload-progress-wrap'));
    const progressLabel = /** @type {HTMLElement | null} */ (container.querySelector('#upload-progress-label'));
    const progressBar = /** @type {HTMLElement | null} */ (container.querySelector('#upload-progress-bar'));
    const errBox = /** @type {HTMLElement | null} */ (container.querySelector('#upload-error-box'));
    const filesContainer = /** @type {HTMLElement | null} */ (container.querySelector('#uploaded-files-container'));

    if (errBox) errBox.hidden = true;
    const mediaRole = roleEl?.value || 'primary';

    for (const file of files) {
      if (progressWrap) progressWrap.hidden = false;
      if (progressLabel) progressLabel.textContent = `Subiendo ${file.name} (0%)...`;
      if (progressBar) progressBar.style.width = '0%';

      const res = await uploadAdminFileWithProgress({
        file,
        dayNumber: formState.dayNumber,
        mediaRole,
        onProgress: (pct) => {
          if (progressLabel) progressLabel.textContent = `Subiendo ${file.name} (${pct}%)...`;
          if (progressBar) progressBar.style.width = `${pct}%`;
        },
      });

      if (!res.ok) {
        if (errBox) {
          errBox.innerHTML = `<span>${lucide.alert}</span><span>${escapeHtml(res.data.error || `Error al subir ${file.name}`)}</span>`;
          errBox.hidden = false;
        }
      } else if (res.data.file) {
        currentFiles.push(res.data.file);
        showToast(`Archivo "${file.name}" subido de forma privada`);
      }
    }

    if (progressWrap) progressWrap.hidden = true;
    if (filesContainer) {
      filesContainer.innerHTML = renderFilesGrid();
      bindFileDeleteButtons();
    }
  };

  const bindFileDeleteButtons = () => {
    container.querySelectorAll('[data-delete-file]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const fileId = btn.getAttribute('data-delete-file');
        if (!fileId) return;
        const confirmed = await confirmDialog({
          title: 'Eliminar archivo adjunto',
          message: 'Este archivo se eliminará permanentemente de Supabase Storage.',
          confirmLabel: 'Eliminar archivo',
        });
        if (!confirmed) return;

        const res = await adminFetchJson(`/api/admin/files/${encodeURIComponent(fileId)}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          currentFiles = currentFiles.filter((f) => f.id !== fileId);
          const filesContainer = container.querySelector('#uploaded-files-container');
          if (filesContainer) {
            filesContainer.innerHTML = renderFilesGrid();
            bindFileDeleteButtons();
          }
          showToast('Archivo eliminado correctamente');
        }
      });
    });
  };

  const bindEditorEvents = () => {
    const form = container.querySelector('#surprise-editor-form');
    const daySelect = /** @type {HTMLSelectElement | null} */ (container.querySelector('#ed-day-select'));
    const typeSelect = /** @type {HTMLSelectElement | null} */ (container.querySelector('#ed-content-type'));
    const previewBtn = container.querySelector('#ed-preview-btn');
    const draftBtn = container.querySelector('#ed-save-draft-btn');
    const deleteBtn = container.querySelector('#ed-delete-btn');
    const autosaveToggle = /** @type {HTMLInputElement | null} */ (container.querySelector('#ed-autosave-toggle'));
    const dropzone = container.querySelector('#file-dropzone');
    const hiddenInput = /** @type {HTMLInputElement | null} */ (container.querySelector('#file-input-hidden'));

    daySelect?.addEventListener('change', () => {
      const nextDay = Number(daySelect.value);
      if (typeof onDayChange === 'function') onDayChange(nextDay);
    });

    typeSelect?.addEventListener('change', () => {
      syncFormStateFromDom();
      formState.contentType = typeSelect.value;
      renderEditor();
    });

    previewBtn?.addEventListener('click', () => {
      syncFormStateFromDom();
      openSurprisePreviewModal({
        dayNumber: formState.dayNumber,
        title: formState.title,
        subtitle: formState.subtitle,
        description: formState.description,
        contentType: formState.contentType,
        contentData: formState.contentData,
        files: currentFiles,
      });
    });

    draftBtn?.addEventListener('click', () => {
      void persistSurprise('draft', false);
    });

    deleteBtn?.addEventListener('click', async () => {
      const confirmed = await confirmDialog({
        title: `Eliminar sorpresa del Día ${formState.dayNumber}`,
        message: 'Se borrarán tanto el contenido como los archivos privados asociados a este día.',
        confirmLabel: 'Sí, eliminar sorpresa',
      });
      if (!confirmed) return;

      const res = await adminFetchJson(`/api/admin/surprises/${formState.dayNumber}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast(`Sorpresa del Día ${formState.dayNumber} eliminada`);
        if (typeof onDeleted === 'function') onDeleted(formState.dayNumber);
      }
    });

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      void persistSurprise(null, false);
    });

    autosaveToggle?.addEventListener('change', () => {
      formState.autosaveEnabled = autosaveToggle.checked;
    });

    form?.addEventListener('input', () => {
      if (!formState.autosaveEnabled) return;
      if (autosaveTimer) clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(() => {
        void persistSurprise('draft', true);
      }, 2200);
    });

    dropzone?.addEventListener('click', () => hiddenInput?.click());
    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dropzone--active');
    });
    dropzone?.addEventListener('dragleave', () => {
      dropzone.classList.remove('dropzone--active');
    });
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dropzone--active');
      const dt = /** @type {DragEvent} */ (e).dataTransfer;
      if (dt?.files) void handleFilesSelected(dt.files);
    });
    hiddenInput?.addEventListener('change', () => {
      if (hiddenInput.files) {
        void handleFilesSelected(hiddenInput.files);
        hiddenInput.value = '';
      }
    });

    bindFileDeleteButtons();
  };

  renderEditor();

  return () => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
  };
}
