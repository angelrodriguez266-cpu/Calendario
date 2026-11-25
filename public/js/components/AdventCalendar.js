import { siteConfig } from '../config/siteConfig.js';
import {
  attachAmbientParticles,
  attachDepthParallax,
  attachScrollReveals,
  runCinematicTransition,
} from '../motion/MotionEngine.js';
import { renderCalendarDayHtml } from './CalendarDay.js';
import {
  escapeHtml,
  renderCornerVelvetRibbon,
  renderDayThematicIconSvg,
  renderEditorialStarDivider,
  renderPadlockSvg,
  renderPineBoughCorner,
  renderRomanticHeartSvg,
} from './DecorativeElements.js';

const LOCKED_DAY_WHISPER = 'Esta sorpresa todavía está esperando su momento';

/**
 * AdventCalendar — Sección 3: Calendario interactivo de 31 días con ambiente vivo,
 * capas de profundidad, entrada escalonada por IntersectionObserver y respuesta
 * delicada al tocar días futuros bloqueados.
 */
export function mountAdventCalendar(container, { authProvider, calendarProvider }) {
  container.innerHTML = `
    <section class="advent-calendar" aria-labelledby="advent-calendar-heading">
      <header class="advent-calendar__topbar">
        <div class="advent-calendar__topbar-inner">
          <button
            type="button"
            class="advent-calendar__brand"
            id="calendar-home-btn"
            aria-label="Volver a la portada"
          >
            <span class="advent-calendar__monogram">${escapeHtml(siteConfig.couple.monogram)}</span>
            ${renderRomanticHeartSvg({ size: 18, className: 'advent-calendar__brand-heart' })}
          </button>

          <span class="advent-calendar__center-tab">Calendario</span>

          <button
            type="button"
            class="advent-calendar__logout"
            id="calendar-logout-btn"
            aria-label="Cerrar sesión privada"
          >
            ${renderPadlockSvg({ size: 15 })}
            <span>Cerrar sobre</span>
          </button>
        </div>
      </header>

      <div class="advent-calendar__canvas ivory-paper-surface">
        <!-- CAPA 2: Variación sutil de iluminación cálida + luces en los bordes -->
        <div class="motion-layer motion-layer--lighting" aria-hidden="true">
          <div class="ambient-paper-light"></div>
          <div class="corner-warm-glow corner-warm-glow--left"></div>
          <div class="corner-warm-glow corner-warm-glow--right"></div>
        </div>

        <!-- CAPA 3: Polvo luminoso dorado y nieve muy sutil -->
        <div class="motion-layer motion-layer--particles" aria-hidden="true">
          <canvas class="motion-particle-canvas" id="calendar-particles-canvas"></canvas>
        </div>

        <!-- CAPA 4: Ramas de pino con movimiento lento y cinta de terciopelo -->
        ${renderPineBoughCorner('top-left', true)}
        ${renderPineBoughCorner('top-right', true)}
        ${renderCornerVelvetRibbon()}

        <!-- CAPA 5: Encabezado progresivo y cuadrícula de 31 tarjetas -->
        <div class="advent-calendar__container">
          <div class="advent-calendar__header">
            <h1 id="advent-calendar-heading" class="advent-calendar__title">
              ${escapeHtml(siteConfig.calendar.title)}
            </h1>

            <p class="advent-calendar__subtitle">
              <span>${escapeHtml(siteConfig.calendar.subtitle)}</span>
              ${renderRomanticHeartSvg({ size: 20, className: 'advent-calendar__subtitle-heart' })}
            </p>

            ${renderEditorialStarDivider()}

            <div id="calendar-clock-slot"></div>
            <div id="calendar-toast-slot"></div>
          </div>

          <div id="calendar-body-slot" style="width:100%;display:flex;flex-direction:column;align-items:center;"></div>

          <div class="advent-calendar__legend" aria-hidden="true">
            <span class="advent-calendar__legend-item">
              <span class="advent-calendar__swatch advent-calendar__swatch--today"></span>
              <span>Día disponible hoy</span>
            </span>
            <span class="advent-calendar__legend-item">
              <span class="advent-calendar__swatch advent-calendar__swatch--unlocked"></span>
              <span>Días desbloqueados</span>
            </span>
            <span class="advent-calendar__legend-item">
              <span class="advent-calendar__swatch advent-calendar__swatch--locked"></span>
              <span>Próximos días (00:00 COL)</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Mensaje delicado al intentar abrir un día futuro -->
      <div class="locked-whisper-toast" id="locked-whisper-toast" role="status" aria-live="polite">
        <span class="locked-whisper-toast__icon">${renderPadlockSvg({ size: 15 })}</span>
        <span id="locked-whisper-text">${LOCKED_DAY_WHISPER}</span>
      </div>

      <div id="calendar-modal-slot"></div>
    </section>
  `;

  const sectionEl = /** @type {HTMLElement} */ (container.querySelector('.advent-calendar'));
  const canvasEl = /** @type {HTMLCanvasElement} */ (container.querySelector('#calendar-particles-canvas'));
  const homeBtn = container.querySelector('#calendar-home-btn');
  const logoutBtn = container.querySelector('#calendar-logout-btn');
  const clockSlot = /** @type {HTMLElement} */ (container.querySelector('#calendar-clock-slot'));
  const toastSlot = /** @type {HTMLElement} */ (container.querySelector('#calendar-toast-slot'));
  const bodySlot = /** @type {HTMLElement} */ (container.querySelector('#calendar-body-slot'));
  const modalSlot = /** @type {HTMLElement} */ (container.querySelector('#calendar-modal-slot'));
  const whisperToast = /** @type {HTMLElement} */ (container.querySelector('#locked-whisper-toast'));
  const whisperText = /** @type {HTMLElement} */ (container.querySelector('#locked-whisper-text'));

  const cleanupParticles = attachAmbientParticles(canvasEl, { mode: 'calendar' });
  const cleanupParallax = attachDepthParallax(sectionEl);

  let cleanupReveals = () => {};
  let hasInitialGridRendered = false;
  let lastGridSignature = '';
  let whisperTimer = null;

  const showLockedDayWhisper = (dayNumber) => {
    whisperText.textContent = `${LOCKED_DAY_WHISPER} (${dayNumber} de diciembre)`;
    whisperToast.classList.add('locked-whisper-toast--visible');
    if (whisperTimer) clearTimeout(whisperTimer);
    whisperTimer = setTimeout(() => {
      whisperToast.classList.remove('locked-whisper-toast--visible');
    }, 3200);
  };

  const renderState = (state) => {
    // 1. Píldora horaria America/Bogota
    if (state.clock) {
      const clockText =
        state.clock.calendarPhase === 'before_december'
          ? `Hora oficial en Colombia: ${escapeHtml(state.clock.formattedDateEs)} · El día 1 se desbloquea el 1 de diciembre a las 00:00`
          : state.clock.calendarPhase === 'december_active'
            ? `Diciembre ${escapeHtml(state.clock.day)} de 2026 · Desbloqueo diario a las 00:00 (Colombia)`
            : 'Diciembre de 2026 completado · Los 31 días están desbloqueados para ti';

      clockSlot.innerHTML = `
        <div class="advent-calendar__clock-pill">
          <span class="advent-calendar__live-dot" aria-hidden="true"></span>
          <span>${clockText}</span>
        </div>
      `;
    } else {
      clockSlot.innerHTML = '';
    }

    // 2. Aviso de desbloqueo en vivo a las 00:00
    if (state.newlyUnlockedDay !== null) {
      toastSlot.innerHTML = `
        <div class="advent-calendar__unlock-toast" role="status">
          Son las 00:00 en Colombia: el Día ${escapeHtml(state.newlyUnlockedDay)} acaba de desbloquearse para ti.
        </div>
      `;
    } else {
      toastSlot.innerHTML = '';
    }

    // 3. Cuadrícula de los 31 días (evita re-montar si no cambiaron los días ni los visitados)
    const gridSignature = JSON.stringify({
      err: state.calendarError,
      loading: state.isLoadingCalendar && state.days.length === 0,
      days: state.days.map((d) => `${d.day}:${d.state}`),
      visited: Array.from(state.visitedDays).sort((a, b) => a - b),
      newly: state.newlyUnlockedDay,
    });

    if (gridSignature !== lastGridSignature) {
      lastGridSignature = gridSignature;

      if (state.calendarError && state.days.length === 0) {
        bodySlot.innerHTML = `
          <div class="advent-calendar__status-msg" role="alert">
            <p>${escapeHtml(state.calendarError)}</p>
          </div>
        `;
      } else if (state.isLoadingCalendar && state.days.length === 0) {
        bodySlot.innerHTML = `
          <p class="advent-calendar__status-msg">Preparando nuestro calendario...</p>
        `;
      } else {
        const cardsHtml = state.days
          .map((dayItem, idx) =>
            renderCalendarDayHtml(dayItem, {
              isVisited: state.visitedDays.has(dayItem.day),
              isNewlyUnlocked: state.newlyUnlockedDay === dayItem.day,
              revealIndex: idx,
              alreadyRevealed: hasInitialGridRendered,
            })
          )
          .join('');

        bodySlot.innerHTML = `<ul class="advent-calendar__grid">${cardsHtml}</ul>`;

        cleanupReveals();
        if (!hasInitialGridRendered && state.days.length > 0) {
          hasInitialGridRendered = true;
          cleanupReveals = attachScrollReveals(bodySlot);
        }
      }
    }

    // 4. Modal individual del día
    if (!state.isLoadingDayDetail && !state.dayDetailError && !state.selectedDayDetail) {
      modalSlot.innerHTML = '';
      return;
    }

    let modalInnerHtml = '';

    if (state.isLoadingDayDetail) {
      modalInnerHtml = `<p class="advent-calendar__status-msg">Abriendo sorpresa...</p>`;
    } else if (state.dayDetailError) {
      modalInnerHtml = `
        <div class="surprise-modal__provisional">
          <h2 id="surprise-modal-title" class="surprise-modal__title">Todavía sellado</h2>
          <p class="surprise-modal__text">${escapeHtml(state.dayDetailError)}</p>
          <button type="button" class="surprise-modal__ribbon" data-close-modal="true">
            Volver al calendario
          </button>
        </div>
      `;
    } else if (state.selectedDayDetail) {
      const detail = state.selectedDayDetail;
      const topRow = `
        <div class="surprise-modal__top">
          <span class="surprise-modal__ribbon">Día ${escapeHtml(detail.day)}</span>
          <span class="surprise-modal__date">${escapeHtml(detail.dateLabel)}</span>
          <button
            type="button"
            class="surprise-modal__close"
            data-close-modal="true"
            aria-label="Cerrar vista del día"
          >✕</button>
        </div>
      `;

      if (detail.isConfigured) {
        const subtitleHtml = detail.subtitle
          ? `<p class="surprise-modal__subtitle">${escapeHtml(detail.subtitle)}</p>`
          : '';
        const paragraphs = (detail.bodyParagraphs || [])
          .map((p) => `<p class="surprise-modal__paragraph">${escapeHtml(p)}</p>`)
          .join('');
        const mediaItems = (detail.mediaUrls || [])
          .map((asset) => {
            if (asset.kind === 'image') {
              return `
                <figure class="surprise-modal__media">
                  <img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.caption || detail.title || 'Recuerdo')}" class="surprise-modal__img" />
                </figure>
              `;
            }
            if (asset.kind === 'video') {
              return `
                <div class="surprise-modal__media">
                  <video controls preload="metadata" class="surprise-modal__video">
                    <source src="${escapeHtml(asset.url)}" type="${escapeHtml(asset.mimeType)}" />
                  </video>
                </div>
              `;
            }
            if (asset.kind === 'audio') {
              return `
                <div class="surprise-modal__audio-box">
                  <audio controls preload="metadata" class="surprise-modal__audio">
                    <source src="${escapeHtml(asset.url)}" type="${escapeHtml(asset.mimeType)}" />
                  </audio>
                </div>
              `;
            }
            if (asset.kind === 'pdf') {
              return `
                <a href="${escapeHtml(asset.url)}" target="_blank" rel="noopener noreferrer" class="surprise-modal__pdf-link">
                  Descargar documento (${escapeHtml(asset.caption || 'PDF')})
                </a>
              `;
            }
            return '';
          })
          .join('');

        const couponOptions =
          detail.contentType === 'coupon' &&
          Array.isArray(detail.contentData?.options) &&
          detail.contentData.options.length > 0
            ? `
              <ul class="surprise-modal__coupon-list">
                ${detail.contentData.options
                  .map((opt) => `<li class="surprise-modal__coupon-item">${escapeHtml(opt)}</li>`)
                  .join('')}
              </ul>
            `
            : '';

        const signature = detail.signature
          ? `<p class="surprise-modal__signature">${escapeHtml(detail.signature)}</p>`
          : '';

        modalInnerHtml = `
          ${topRow}
          <div class="surprise-modal__configured">
            ${detail.title ? `<h2 id="surprise-modal-title" class="surprise-modal__title">${escapeHtml(detail.title)}</h2>` : ''}
            ${subtitleHtml}
            ${paragraphs}
            ${mediaItems}
            ${couponOptions}
            ${signature}
          </div>
        `;
      } else {
        const sealIcon =
          detail.specialMilestone === 'christmas'
            ? 'star-christmas'
            : detail.specialMilestone === 'finale'
              ? 'finale-crown'
              : 'letter';

        const heading =
          detail.specialMilestone === 'christmas'
            ? 'Sorpresa especial de Navidad'
            : detail.specialMilestone === 'finale'
              ? 'Sorpresa especial de cierre'
              : `Sorpresa del ${escapeHtml(detail.dateLabel)}`;

        modalInnerHtml = `
          ${topRow}
          <div class="surprise-modal__provisional">
            <div class="surprise-modal__seal">
              ${renderDayThematicIconSvg(sealIcon, { size: 24 })}
            </div>
            <h2 id="surprise-modal-title" class="surprise-modal__title">${heading}</h2>
            ${renderEditorialStarDivider()}
            <p class="surprise-modal__text">
              Este espacio ya está desbloqueado y preparado para incorporar el detalle especial reservado para este día.
            </p>
            <span class="surprise-modal__script">${escapeHtml(siteConfig.couple.names)}</span>
          </div>
        `;
      }
    }

    modalSlot.innerHTML = `
      <div
        class="surprise-modal-overlay"
        data-modal-backdrop="true"
        role="dialog"
        aria-modal="true"
        aria-labelledby="surprise-modal-title"
      >
        <div class="surprise-modal ivory-paper-surface">
          ${modalInnerHtml}
        </div>
      </div>
    `;
  };

  const handleGridClick = (event) => {
    const btn = /** @type {HTMLButtonElement | null} */ (
      event.target.closest('[data-day-number]')
    );
    if (!btn) return;

    const dayNumber = Number(btn.getAttribute('data-day-number'));
    if (!Number.isInteger(dayNumber)) return;

    // Día futuro bloqueado: vibración sutil + mensaje delicado (sin abrir ni consultar API)
    if (btn.getAttribute('data-locked') === 'true') {
      btn.classList.remove('calendar-day--locked-nudge');
      void btn.offsetWidth;
      btn.classList.add('calendar-day--locked-nudge');
      showLockedDayWhisper(dayNumber);
      return;
    }

    // Día desbloqueado o disponible hoy: micro-apertura + modal de sorpresa
    btn.classList.remove('calendar-day--opening');
    void btn.offsetWidth;
    btn.classList.add('calendar-day--opening');
    setTimeout(() => {
      void calendarProvider.openDaySurprise(dayNumber);
    }, 240);
  };

  const handleModalClick = (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (
      target.hasAttribute('data-modal-backdrop') ||
      target.closest('[data-close-modal="true"]')
    ) {
      calendarProvider.closeDaySurprise();
    }
  };

  const handleEscape = (event) => {
    if (event.key === 'Escape') {
      calendarProvider.closeDaySurprise();
    }
  };

  const handleHome = () => {
    runCinematicTransition(() => authProvider.goToHero(), { tone: 'warm' });
  };
  const handleLogout = () => {
    runCinematicTransition(() => void authProvider.logout(), { tone: 'ivory' });
  };

  homeBtn?.addEventListener('click', handleHome);
  logoutBtn?.addEventListener('click', handleLogout);
  bodySlot.addEventListener('click', handleGridClick);
  modalSlot.addEventListener('click', handleModalClick);
  window.addEventListener('keydown', handleEscape);

  const unsubscribe = calendarProvider.subscribe(renderState);
  renderState(calendarProvider.getState());
  void calendarProvider.refreshCalendar();

  return () => {
    unsubscribe();
    cleanupReveals();
    cleanupParticles();
    cleanupParallax();
    if (whisperTimer) clearTimeout(whisperTimer);
    homeBtn?.removeEventListener('click', handleHome);
    logoutBtn?.removeEventListener('click', handleLogout);
    bodySlot.removeEventListener('click', handleGridClick);
    modalSlot.removeEventListener('click', handleModalClick);
    window.removeEventListener('keydown', handleEscape);
  };
}
