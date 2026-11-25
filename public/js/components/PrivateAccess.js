import { siteConfig } from '../config/siteConfig.js';
import {
  attachAmbientParticles,
  attachDepthParallax,
  prefersReducedMotion,
  runCinematicTransition,
} from '../motion/MotionEngine.js';
import {
  escapeHtml,
  renderArrowRightSvg,
  renderEditorialStarDivider,
  renderEnvelopeSidePineSvg,
  renderEyeToggleSvg,
  renderOrnamentalPaperFrame,
  renderPadlockSvg,
  renderRomanticHeartSvg,
  renderVelvetRibbonWingSvg,
} from './DecorativeElements.js';

/**
 * PrivateAccess — Sección 2: Acceso privado con sobre borgoña vivo,
 * sello de cera M&A iluminado, cintas oscilantes y apertura cinematográfica.
 */
export function mountPrivateAccess(container, { authProvider }) {
  const { isServerConfigured } = authProvider.getState();

  container.innerHTML = `
    <section class="private-access ivory-paper-surface" aria-labelledby="private-access-title">
      <!-- CAPA 2: Iluminación cálida ambiental respirando sobre el papel -->
      <div class="motion-layer motion-layer--lighting" aria-hidden="true">
        <div class="ambient-paper-light"></div>
      </div>

      <!-- CAPA 3: Partículas doradas, destellos y micro-corazones flotando -->
      <div class="motion-layer motion-layer--particles" aria-hidden="true">
        <canvas class="motion-particle-canvas" id="access-particles-canvas"></canvas>
      </div>

      <!-- CAPA 4: Marco editorial fino con brillo dorado recorriendo el borde -->
      ${renderOrnamentalPaperFrame()}

      <button
        type="button"
        class="private-access__back"
        id="access-back-btn"
        aria-label="Volver a la portada de bienvenida"
      >
        <span aria-hidden="true">←</span>
        <span>Portada</span>
      </button>

      <!-- CAPA 5: Sobre interactivo + formulario privado -->
      <div class="private-access__center">
        <div class="envelope-composition" aria-hidden="true">
          <div class="envelope-composition__velvet-left">
            <div class="parallax-wrap" data-parallax-depth="0.24">
              <div class="velvet-oscillate">
                ${renderVelvetRibbonWingSvg('left')}
              </div>
            </div>
          </div>
          <div class="envelope-composition__velvet-right">
            <div class="parallax-wrap" data-parallax-depth="-0.24">
              <div class="velvet-oscillate velvet-oscillate--delayed">
                ${renderVelvetRibbonWingSvg('right')}
              </div>
            </div>
          </div>

          <div class="envelope-composition__pine-left">
            <div class="parallax-wrap" data-parallax-depth="0.32">
              <div class="pine-sway">
                ${renderEnvelopeSidePineSvg()}
              </div>
            </div>
          </div>
          <div class="envelope-composition__pine-right">
            <div class="parallax-wrap" data-parallax-depth="-0.32">
              <div class="pine-sway pine-sway--right">
                ${renderEnvelopeSidePineSvg()}
              </div>
            </div>
          </div>

          <div class="parallax-wrap" data-parallax-depth="0.10">
            <div class="envelope-stage" id="interactive-envelope">
              <div class="envelope-stage__back"></div>

              <div class="envelope-stage__inner-card">
                <span class="envelope-stage__inner-script">Bienvenida, María</span>
                <span class="envelope-stage__inner-sub">Diciembre 2026</span>
              </div>

              <div class="envelope-stage__pocket">
                <svg class="envelope-stage__pocket-svg" viewBox="0 0 360 234" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="envLeftFold" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#7f3745" />
                      <stop offset="100%" stop-color="#612531" />
                    </linearGradient>
                    <linearGradient id="envRightFold" x1="100%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stop-color="#783441" />
                      <stop offset="100%" stop-color="#5a222d" />
                    </linearGradient>
                    <linearGradient id="envBottomFold" x1="50%" y1="0%" x2="50%" y2="100%">
                      <stop offset="0%" stop-color="#843947" />
                      <stop offset="100%" stop-color="#652734" />
                    </linearGradient>
                  </defs>
                  <polygon points="0,0 185,126 0,234" fill="url(#envLeftFold)" />
                  <polygon points="360,0 175,126 360,234" fill="url(#envRightFold)" />
                  <polygon points="0,234 180,114 360,234" fill="url(#envBottomFold)" />
                  <path d="M0 234L180 114L360 234" stroke="#C6A46F" stroke-opacity="0.22" stroke-width="1" fill="none" />
                </svg>
              </div>

              <div class="envelope-stage__flap">
                <svg class="envelope-stage__flap-svg" viewBox="0 0 360 146" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="envTopFlapGrad" x1="50%" y1="0%" x2="50%" y2="100%">
                      <stop offset="0%" stop-color="#8b3d4c" />
                      <stop offset="65%" stop-color="#783441" />
                      <stop offset="100%" stop-color="#612531" />
                    </linearGradient>
                  </defs>
                  <polygon points="0,0 360,0 180,142" fill="url(#envTopFlapGrad)" />
                  <path d="M2 1L180 141L358 1" stroke="#C6A46F" stroke-opacity="0.28" stroke-width="1.1" fill="none" />
                </svg>
              </div>

              <div class="wax-seal">
                <div class="wax-seal__ring">
                  <span class="wax-seal__initials">${escapeHtml(siteConfig.couple.monogram)}</span>
                </div>
              </div>
              <span class="seal-sparkle-ring"></span>
            </div>
          </div>
        </div>

        <div class="private-access__divider">
          ${renderEditorialStarDivider()}
        </div>

        <h2 id="private-access-title" class="private-access__title">
          <span>${escapeHtml(siteConfig.privateAccess.title)}</span>
          ${renderRomanticHeartSvg({ size: 24, className: 'private-access__title-heart' })}
        </h2>

        <p class="private-access__subtitle">${escapeHtml(siteConfig.privateAccess.subtitle)}</p>

        <form class="private-access__form" id="private-access-form" novalidate>
          <div class="private-access__input-shell" id="password-input-shell">
            <span class="private-access__lock-icon">
              ${renderPadlockSvg({ size: 19 })}
            </span>

            <label for="private-access-password" class="sr-only">Clave especial de acceso</label>
            <input
              id="private-access-password"
              type="password"
              placeholder="${escapeHtml(siteConfig.privateAccess.placeholder)}"
              autocomplete="current-password"
              class="private-access__input"
            />

            <button
              type="button"
              class="private-access__toggle"
              id="toggle-password-btn"
              aria-label="Mostrar contraseña"
              aria-pressed="false"
            >
              ${renderEyeToggleSvg(false, 19)}
            </button>
          </div>

          <div
            class="private-access__error"
            id="password-error-box"
            role="alert"
            ${isServerConfigured ? 'hidden' : ''}
          >
            ${isServerConfigured ? '' : escapeHtml(siteConfig.privateAccess.unconfiguredServerMessage)}
          </div>

          <button type="submit" class="private-access__submit" id="access-submit-btn">
            <span id="access-submit-label">${escapeHtml(siteConfig.privateAccess.submitLabel)}</span>
            <span id="access-submit-arrow" class="private-access__submit-arrow">${renderArrowRightSvg(17)}</span>
          </button>
        </form>
      </div>
    </section>
  `;

  const sectionEl = /** @type {HTMLElement} */ (container.querySelector('.private-access'));
  const canvasEl = /** @type {HTMLCanvasElement} */ (container.querySelector('#access-particles-canvas'));
  const backBtn = container.querySelector('#access-back-btn');
  const form = /** @type {HTMLFormElement} */ (container.querySelector('#private-access-form'));
  const inputShell = container.querySelector('#password-input-shell');
  const passwordInput = /** @type {HTMLInputElement} */ (container.querySelector('#private-access-password'));
  const toggleBtn = container.querySelector('#toggle-password-btn');
  const errorBox = /** @type {HTMLElement} */ (container.querySelector('#password-error-box'));
  const submitBtn = /** @type {HTMLButtonElement} */ (container.querySelector('#access-submit-btn'));
  const submitLabel = container.querySelector('#access-submit-label');
  const submitArrow = /** @type {HTMLElement} */ (container.querySelector('#access-submit-arrow'));
  const envelopeEl = container.querySelector('#interactive-envelope');

  const cleanupParticles = attachAmbientParticles(canvasEl, { mode: 'access' });
  const cleanupParallax = attachDepthParallax(sectionEl);

  let showPassword = false;
  let isBusy = false;

  const setError = (msg) => {
    if (!msg) {
      errorBox.hidden = true;
      errorBox.textContent = '';
      inputShell?.classList.remove('private-access__input-shell--error');
      return;
    }
    errorBox.textContent = msg;
    errorBox.hidden = false;
    inputShell?.classList.remove('private-access__input-shell--error');
    void /** @type {HTMLElement} */ (inputShell)?.offsetWidth;
    inputShell?.classList.add('private-access__input-shell--error');
  };

  const handleBack = () => {
    runCinematicTransition(() => authProvider.goToHero(), { tone: 'warm' });
  };

  const handleToggleVisibility = () => {
    showPassword = !showPassword;
    passwordInput.type = showPassword ? 'text' : 'password';
    toggleBtn?.setAttribute(
      'aria-label',
      showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
    );
    toggleBtn?.setAttribute('aria-pressed', String(showPassword));
    if (toggleBtn) {
      toggleBtn.innerHTML = renderEyeToggleSvg(showPassword, 19);
    }
  };

  const handleInput = () => {
    if (!errorBox.hidden && authProvider.getState().isServerConfigured) {
      setError(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isBusy) return;

    const rawValue = passwordInput.value;
    if (!rawValue.trim()) {
      setError('Por favor ingresa la clave especial para abrir el sobre.');
      passwordInput.focus();
      return;
    }

    isBusy = true;
    submitBtn.disabled = true;
    passwordInput.disabled = true;
    if (submitLabel) submitLabel.textContent = 'Verificando...';
    if (submitArrow) submitArrow.hidden = true;

    const result = await authProvider.loginWithPassword(rawValue);

    if (!result.ok) {
      isBusy = false;
      submitBtn.disabled = false;
      passwordInput.disabled = false;
      if (submitLabel) submitLabel.textContent = siteConfig.privateAccess.submitLabel;
      if (submitArrow) submitArrow.hidden = false;
      setError(result.message || siteConfig.privateAccess.invalidPasswordMessage);
      passwordInput.select();
      return;
    }

    // Secuencia cinematográfica de apertura del sobre: sello -> solapa -> carta -> calendario
    passwordInput.value = '';
    setError(null);
    if (submitLabel) submitLabel.textContent = 'Abriendo nuestra historia...';
    envelopeEl?.classList.add('envelope-stage--opening');

    if (prefersReducedMotion()) {
      setTimeout(() => authProvider.goToCalendarIfAuthenticated(), 120);
      return;
    }

    setTimeout(() => {
      runCinematicTransition(() => authProvider.goToCalendarIfAuthenticated(), {
        tone: 'ivory',
      });
    }, 840);
  };

  backBtn?.addEventListener('click', handleBack);
  toggleBtn?.addEventListener('click', handleToggleVisibility);
  passwordInput?.addEventListener('input', handleInput);
  form?.addEventListener('submit', handleSubmit);

  return () => {
    backBtn?.removeEventListener('click', handleBack);
    toggleBtn?.removeEventListener('click', handleToggleVisibility);
    passwordInput?.removeEventListener('input', handleInput);
    form?.removeEventListener('submit', handleSubmit);
    cleanupParticles();
    cleanupParallax();
  };
}
