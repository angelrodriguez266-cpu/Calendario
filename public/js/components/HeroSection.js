import { siteConfig } from '../config/siteConfig.js';
import {
  attachAmbientParticles,
  attachDepthParallax,
  runCinematicTransition,
} from '../motion/MotionEngine.js';
import {
  escapeHtml,
  renderArrowRightSvg,
  renderCinemaClapperSvg,
  renderEditorialStarDivider,
  renderHeroAtmosphereLayer,
  renderPineBoughCorner,
  renderRomanticHeartSvg,
} from './DecorativeElements.js';

/**
 * HeroSection — Sección 1: Portada cinematográfica en 5 capas de profundidad
 * @param {HTMLElement} container
 * @param {{ authProvider: import('../providers/AuthenticationProvider.js').AuthenticationProvider }} deps
 */
export function mountHeroSection(container, { authProvider }) {
  container.innerHTML = `
    <section class="hero-section" aria-labelledby="hero-main-title">
      <!-- CAPA 1: Fotografía principal con zoom lento Ken Burns + parallax -->
      <div class="hero-section__backdrop-wrap parallax-wrap" data-parallax-depth="-0.15" data-scroll-depth="0.12">
        <img
          src="${escapeHtml(siteConfig.hero.imageSrc)}"
          alt="${escapeHtml(siteConfig.hero.imageAlt)}"
          class="hero-section__backdrop-img"
          fetchpriority="high"
        />
      </div>

      <!-- CAPA 2: Overlay cinematográfico + iluminación ambiental cálida + bokeh -->
      <div class="hero-section__overlay" aria-hidden="true"></div>
      <div class="hero-section__ambient-light" aria-hidden="true"></div>
      ${renderHeroAtmosphereLayer()}

      <!-- CAPA 3: Partículas en 3 planos (nieve multipaso + motas doradas) -->
      <div class="motion-layer motion-layer--particles" aria-hidden="true">
        <canvas class="motion-particle-canvas" id="hero-particles-canvas"></canvas>
      </div>

      <!-- CAPA 4: Ramas de pino y frutos rojos con balanceo sutil al viento -->
      ${renderPineBoughCorner('bottom-left')}
      ${renderPineBoughCorner('bottom-right')}

      <!-- CAPA 5: Contenido editorial con secuencia de 6 tiempos -->
      <div class="hero-section__container">
        <div class="hero-section__editorial parallax-wrap" data-parallax-depth="0.08">
          <!-- 1. Destello inicial -->
          <div class="hero-section__opening-gleam" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L14.2 9.8L23 12L14.2 14.2L12 23L9.8 14.2L1 12L9.8 9.8L12 1Z" />
            </svg>
          </div>

          <!-- 2. Claqueta + «Una historia de» -->
          <div class="hero-section__clapper-row">
            <div class="hero-section__clapper">
              ${renderCinemaClapperSvg({ size: 28 })}
            </div>
            <p class="hero-section__eyebrow">${escapeHtml(siteConfig.hero.eyebrow)}</p>
          </div>

          <!-- 3. «María y Ángel» -->
          <h1 id="hero-main-title" class="hero-section__title">
            ${escapeHtml(siteConfig.hero.title)}
          </h1>

          <!-- 4. Subtítulo manuscrito con escritura + trazado de corazón -->
          <p class="hero-section__subtitle">
            <span class="hero-section__subtitle-text">${escapeHtml(siteConfig.hero.subtitle)}</span>
            ${renderRomanticHeartSvg({
              size: 25,
              className: 'hero-section__subtitle-heart',
              drawStroke: true,
            })}
          </p>

          <!-- 5. Separador y frase secundaria -->
          <div class="hero-section__divider">
            ${renderEditorialStarDivider()}
          </div>

          <p class="hero-section__phrase">
            ${escapeHtml(siteConfig.hero.description)}
          </p>

          <!-- 6. Botón principal con brillo y transición cinematográfica -->
          <button type="button" class="hero-section__cta" id="hero-enter-btn">
            <span>${escapeHtml(siteConfig.hero.ctaLabel)}</span>
            <span class="hero-section__cta-arrow">
              ${renderArrowRightSvg(18)}
            </span>
          </button>
        </div>
      </div>

      ${
        siteConfig.hero.isTemporaryReference
          ? `<span class="hero-section__reference-note">${escapeHtml(siteConfig.hero.referenceNote)}</span>`
          : ''
      }
    </section>
  `;

  const sectionEl = /** @type {HTMLElement} */ (container.querySelector('.hero-section'));
  const canvasEl = /** @type {HTMLCanvasElement} */ (container.querySelector('#hero-particles-canvas'));
  const enterButton = container.querySelector('#hero-enter-btn');

  const cleanupParticles = attachAmbientParticles(canvasEl, { mode: 'hero' });
  const cleanupParallax = attachDepthParallax(sectionEl);

  let isNavigating = false;
  const handleEnter = () => {
    if (isNavigating) return;
    isNavigating = true;
    runCinematicTransition(() => authProvider.goToAccess(), { tone: 'warm' });
  };

  enterButton?.addEventListener('click', handleEnter);

  return () => {
    enterButton?.removeEventListener('click', handleEnter);
    cleanupParticles();
    cleanupParallax();
  };
}
