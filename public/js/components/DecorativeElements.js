/**
 * DecorativeElements
 * Iconografía vectorial profesional a medida, atmósfera de nieve sutil,
 * ramas de pino, marcos editoriales y cintas de terciopelo borgoña.
 * Cero uso de emojis del sistema.
 */

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderRomanticHeartSvg({
  size = 20,
  className = '',
  drawStroke = false,
} = {}) {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" class="${className}" aria-hidden="true">
      <path
        ${drawStroke ? 'pathLength="100" class="heart-draw-path"' : ''}
        d="M12.1 20.3C7.15 16.45 3.5 13.05 3.5 8.85C3.5 6.1 5.65 4 8.3 4C10.05 4 11.35 4.95 12.1 6.25C12.85 4.95 14.25 4 15.95 4C18.6 4 20.65 6.1 20.65 8.85C20.65 13.05 17.05 16.45 12.1 20.3Z"
      />
    </svg>
  `;
}

export function renderCinemaClapperSvg({ size = 28 } = {}) {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="4" y="10" width="20" height="14" rx="2.2" />
      <path d="M4.4 10L23.2 5.4C23.9 5.2 24.5 5.65 24.65 6.35L25.2 8.7L4.4 10Z" />
      <path d="M9.5 8.8L11.8 10" />
      <path d="M15.2 7.4L17.5 9.6" />
      <polygon points="12.2,14.3 12.2,19.7 16.8,17" fill="currentColor" stroke="none" />
    </svg>
  `;
}

export function renderEditorialStarDivider() {
  return `
    <div class="star-divider" aria-hidden="true">
      <span class="star-divider__line-left"></span>
      <span class="star-divider__gem">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1.5L13.9 9.1L21.5 11L13.9 12.9L12 20.5L10.1 12.9L2.5 11L10.1 9.1L12 1.5Z" />
          <path d="M6.2 5.2L11 10M17.8 5.2L13 10M6.2 16.8L11 12M17.8 16.8L13 12" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" />
        </svg>
      </span>
      <span class="star-divider__line-right"></span>
    </div>
  `;
}

export function renderPadlockSvg({ size = 18, className = '' } = {}) {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" class="${className}" aria-hidden="true">
      <rect x="5.5" y="11" width="13" height="9.5" rx="2.2" />
      <path d="M8.2 11V7.8C8.2 5.7 9.9 4 12 4C14.1 4 15.8 5.7 15.8 7.8V11" />
      <circle cx="12" cy="15.4" r="1.15" fill="currentColor" stroke="none" />
      <path d="M12 16.4V17.9" />
    </svg>
  `;
}

export function renderEyeToggleSvg(visible, size = 19) {
  if (visible) {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 3L21 21" />
        <path d="M10.58 10.58A2 2 0 0 0 13.42 13.42" />
        <path d="M9.88 5.09A10.4 10.4 0 0 1 12 4.85C17.2 4.85 20.9 9.5 21.8 11.45A1.3 1.3 0 0 1 21.8 12.55A16.5 16.5 0 0 1 18.25 16.95" />
        <path d="M6.35 6.35C4.3 7.8 2.85 9.9 2.2 11.45A1.3 1.3 0 0 0 2.2 12.55C3.1 14.5 6.8 19.15 12 19.15C13.85 19.15 15.52 18.58 16.95 17.72" />
      </svg>
    `;
  }
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M2.2 12C3.3 9.4 6.95 5 12 5C17.05 5 20.7 9.4 21.8 12C20.7 14.6 17.05 19 12 19C6.95 19 3.3 14.6 2.2 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  `;
}

export function renderArrowRightSvg(size = 18) {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4.5 12H19.5" />
      <path d="M13.5 6L19.5 12L13.5 18" />
    </svg>
  `;
}

export function renderCheckMarkSvg(size = 11) {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3.2 8.4L6.5 11.6L12.8 4.8" />
    </svg>
  `;
}

export function renderDayThematicIconSvg(icon, { size = 20, className = '' } = {}) {
  switch (icon) {
    case 'pine':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" class="${className}" aria-hidden="true">
          <path d="M5 19L19 5" />
          <path d="M9.5 14.5L6.5 13.8M9.5 14.5L10.2 17.5" />
          <path d="M12.5 11.5L8.8 10.6M12.5 11.5L13.4 15.2" />
          <path d="M15.5 8.5L11.8 7.6M15.5 8.5L16.4 12.2" />
          <circle cx="8" cy="16" r="1" fill="var(--color-borgona)" stroke="none" />
          <circle cx="14.6" cy="9.4" r="0.9" fill="var(--color-borgona)" stroke="none" />
        </svg>
      `;
    case 'gift':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" class="${className}" aria-hidden="true">
          <rect x="4" y="9" width="16" height="4" rx="1" />
          <path d="M5.5 13V19C5.5 19.8 6.2 20.5 7 20.5H17C17.8 20.5 18.5 19.8 18.5 19V13" />
          <path d="M12 9V20.5" />
          <path d="M12 9C12 9 8.2 9 7.5 6.8C6.9 5 8.6 3.8 10.2 4.8C11.3 5.5 12 9 12 9Z" />
          <path d="M12 9C12 9 15.8 9 16.5 6.8C17.1 5 15.4 3.8 13.8 4.8C12.7 5.5 12 9 12 9Z" />
        </svg>
      `;
    case 'heart':
      return renderRomanticHeartSvg({ size, className });
    case 'letter':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" class="${className}" aria-hidden="true">
          <rect x="3.5" y="6" width="17" height="12.5" rx="1.8" />
          <path d="M4.2 7L12 12.8L19.8 7" />
        </svg>
      `;
    case 'star-christmas':
      return `
        <svg width="${size + 2}" height="${size + 2}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" class="${className}" aria-hidden="true">
          <polygon points="12,2.4 14.6,8.7 21.4,9.3 16.2,13.8 17.8,20.5 12,16.9 6.2,20.5 7.8,13.8 2.6,9.3 9.4,8.7" />
          <circle cx="12" cy="12.2" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      `;
    case 'finale-crown':
      return `
        <svg width="${size + 2}" height="${size + 2}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="${className}" aria-hidden="true">
          <path d="M12 2.5L13.8 8.2L19.5 10L13.8 11.8L12 17.5L10.2 11.8L4.5 10L10.2 8.2L12 2.5Z" />
          <path d="M18.5 16L19.3 18.4L21.7 19.2L19.3 20L18.5 22.4L17.7 20L15.3 19.2L17.7 18.4L18.5 16Z" />
          <path d="M5.5 15.5L6.1 17.3L7.9 17.9L6.1 18.5L5.5 20.3L4.9 18.5L3.1 17.9L4.9 17.3L5.5 15.5Z" />
        </svg>
      `;
    default:
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" class="${className}" aria-hidden="true">
          <path d="M12 3.5L13.9 9.8L20.2 11.7L13.9 13.6L12 19.9L10.1 13.6L3.8 11.7L10.1 9.8L12 3.5Z" />
        </svg>
      `;
  }
}

const SNOWFLAKES = [
  { left: '6%', size: 2.5, duration: '15s', delay: '-2s', drift: '22px', opacity: 0.35 },
  { left: '14%', size: 3.2, duration: '19s', delay: '-9s', drift: '-16px', opacity: 0.28 },
  { left: '23%', size: 2.2, duration: '14s', delay: '-5s', drift: '18px', opacity: 0.42 },
  { left: '32%', size: 3.5, duration: '21s', delay: '-13s', drift: '28px', opacity: 0.24 },
  { left: '41%', size: 2.0, duration: '16s', delay: '-7s', drift: '-14px', opacity: 0.38 },
  { left: '51%', size: 2.8, duration: '18s', delay: '-11s', drift: '20px', opacity: 0.32 },
  { left: '60%', size: 2.3, duration: '15.5s', delay: '-3s', drift: '-18px', opacity: 0.36 },
  { left: '69%', size: 3.4, duration: '20s', delay: '-14s', drift: '24px', opacity: 0.25 },
  { left: '78%', size: 2.4, duration: '16.5s', delay: '-6s', drift: '-15px', opacity: 0.34 },
  { left: '87%', size: 2.9, duration: '18.5s', delay: '-10s', drift: '16px', opacity: 0.30 },
  { left: '94%', size: 2.1, duration: '14.5s', delay: '-4s', drift: '-20px', opacity: 0.38 },
];

const BOKEH_ORBS = [
  { left: '8%', top: '18%', size: 68, delay: '0s' },
  { left: '19%', top: '66%', size: 92, delay: '-3s' },
  { left: '44%', top: '24%', size: 54, delay: '-6s' },
  { left: '74%', top: '16%', size: 84, delay: '-2s' },
  { left: '86%', top: '58%', size: 74, delay: '-5s' },
];

export function renderHeroAtmosphereLayer() {
  const orbsHtml = BOKEH_ORBS.map(
    (orb) =>
      `<span class="bokeh-orb" style="left:${orb.left};top:${orb.top};width:${orb.size}px;height:${orb.size}px;animation-delay:${orb.delay};"></span>`
  ).join('');

  return `<div class="atmosphere-layer parallax-wrap" data-parallax-depth="0.22" aria-hidden="true">${orbsHtml}</div>`;
}

export function renderPineBoughCorner(position, withWarmLights = false) {
  const isTop = position.startsWith('top');
  const isRight = position.endsWith('right');
  const swayClass = [
    'pine-sway',
    isTop ? 'pine-sway--top' : '',
    isRight ? 'pine-sway--right' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const depth = isRight ? '-0.34' : '0.34';
  const scrollDepth = isTop ? '-0.06' : '0.05';

  const lightsSvg = withWarmLights
    ? `
      <g class="fairy-lights-pulse">
        <circle cx="96" cy="144" r="16" fill="#C6A46F" fill-opacity="0.32" />
        <circle cx="96" cy="144" r="4.5" fill="#F3EBDD" />
        <circle cx="48" cy="102" r="14" fill="#C6A46F" fill-opacity="0.28" />
        <circle cx="48" cy="102" r="3.8" fill="#F3EBDD" />
        <circle cx="148" cy="154" r="13" fill="#C6A46F" fill-opacity="0.26" />
        <circle cx="148" cy="154" r="3.4" fill="#F3EBDD" />
      </g>
    `
    : '';

  return `
    <div class="pine-corner pine-corner--${position}" aria-hidden="true">
      <div class="parallax-wrap" data-parallax-depth="${depth}" data-scroll-depth="${scrollDepth}">
        <div class="${swayClass}">
          <svg viewBox="0 0 240 190" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;${isTop ? 'transform:scaleY(-1);' : ''}">
            <g opacity="0.20">
              <path d="M-8 196C42 152 96 124 188 158" stroke="#292724" stroke-width="8" stroke-linecap="round" />
            </g>
            <!-- Capa profunda de agujas de pino (densidad botánica) -->
            <g stroke="#1d2e27" stroke-width="2.6" stroke-linecap="round">
              <path d="M14 170L-2 132M21 166L10 122M28 162L23 118M36 158L38 115M45 154L55 115M55 151L72 117M66 149L89 120M78 148L106 124M91 147L122 128M105 148L138 133M120 149L154 138M136 152L170 145" />
              <path d="M22 165L54 186M36 158L72 184M52 152L92 182M72 149L112 180M94 148L134 178M116 150L154 178" />
              <path d="M10 152L-10 122M15 140L-2 104M21 128L7 90M28 114L19 76M36 100L31 62M44 84L43 48M52 68L55 36" />
              <path d="M14 146L48 136M20 132L56 120M28 116L66 104M36 100L72 88M44 84L78 72M52 68L82 56" />
            </g>
            <!-- Tallos leñosos -->
            <path d="M-10 192C38 148 102 128 192 162" stroke="#292724" stroke-width="3.2" stroke-linecap="round" />
            <path d="M-6 184C20 132 42 86 68 38" stroke="#292724" stroke-width="2.8" stroke-linecap="round" />
            <!-- Capa principal verde noche (#263B32) -->
            <g stroke="#263B32" stroke-width="2.1" stroke-linecap="round">
              <path d="M18 168L4 128M24 164L16 120M32 160L30 116M40 156L46 114M50 152L64 116M60 150L80 118M72 148L98 122M84 147L114 126M98 147L130 130M112 148L146 135M128 150L162 141M144 153L178 148" />
              <path d="M28 162L62 184M44 155L82 182M62 150L102 180M82 148L122 178M104 148L144 177M126 151L164 178" />
              <path d="M12 148L-8 118M18 136L2 100M24 124L12 86M32 110L24 72M40 96L36 58M48 80L48 44M56 64L60 32" />
              <path d="M16 142L52 132M24 126L62 114M32 110L70 98M40 94L76 82M48 78L82 66M56 62L84 52" />
            </g>
            <!-- Reflejos cálidos champán en puntas seleccionadas -->
            <g stroke="#C6A46F" stroke-opacity="0.36" stroke-width="1.15" stroke-linecap="round">
              <path d="M32 160L30 122M60 150L78 122M98 147L126 132M32 110L66 99M48 78L78 68" />
            </g>
            ${lightsSvg}
            <!-- Frutos rojos invernales -->
            <g>
              <circle cx="34" cy="154" r="6.8" fill="#783441" />
              <circle cx="32" cy="152" r="1.8" fill="#F3EBDD" fill-opacity="0.55" />
              <circle cx="45" cy="161" r="6.0" fill="#783441" />
              <circle cx="43.5" cy="159" r="1.5" fill="#F3EBDD" fill-opacity="0.5" />
              <circle cx="26" cy="165" r="5.6" fill="#5e2530" />
              <circle cx="24.5" cy="163.5" r="1.4" fill="#C18C83" fill-opacity="0.6" />
              <circle cx="38" cy="143" r="5.2" fill="#783441" />
              <circle cx="36.5" cy="141.5" r="1.4" fill="#F3EBDD" fill-opacity="0.5" />
              <circle cx="22" cy="148" r="5.0" fill="#682a36" />
              <circle cx="20.8" cy="146.8" r="1.3" fill="#C18C83" fill-opacity="0.55" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  `;
}

export function renderOrnamentalPaperFrame() {
  return `
    <div class="ornamental-frame" aria-hidden="true">
      <svg class="ornamental-frame__svg" viewBox="0 0 1000 700" preserveAspectRatio="none">
        <path
          d="M 26 4 L 974 4 A 22 22 0 0 0 996 26 L 996 674 A 22 22 0 0 0 974 696 L 26 696 A 22 22 0 0 0 4 674 L 4 26 A 22 22 0 0 0 26 4 Z"
          fill="none"
          stroke="var(--color-oro-champan)"
          stroke-opacity="0.54"
          stroke-width="1.2"
          vector-effect="non-scaling-stroke"
        />
        <path
          class="ornamental-frame__glint"
          d="M 26 4 L 974 4 A 22 22 0 0 0 996 26 L 996 674 A 22 22 0 0 0 974 696 L 26 696 A 22 22 0 0 0 4 674 L 4 26 A 22 22 0 0 0 26 4 Z"
          fill="none"
          stroke="#F3EBDD"
          stroke-opacity="0.72"
          stroke-width="1.4"
          pathLength="100"
          vector-effect="non-scaling-stroke"
        />
      </svg>
    </div>
  `;
}

export function renderCornerVelvetRibbon() {
  return `
    <div class="corner-velvet-ribbon" aria-hidden="true">
      <div class="parallax-wrap" data-parallax-depth="-0.28" data-scroll-depth="0.04">
        <div class="velvet-oscillate velvet-oscillate--delayed">
          <svg viewBox="0 0 260 180" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="velvetGradCorner" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#8c3f4e" />
                <stop offset="48%" stop-color="#783441" />
                <stop offset="100%" stop-color="#4c1e27" />
              </linearGradient>
            </defs>
            <path d="M270 32C212 38 188 94 142 126C98 156 54 152 12 188L58 192C98 166 136 164 176 132C214 102 228 62 272 56Z" fill="url(#velvetGradCorner)" />
            <path d="M268 74C226 92 204 134 182 188L214 190C230 148 244 116 272 100Z" fill="#5c242f" />
            <path d="M270 34C214 40 190 96 144 127C100 157 56 153 16 187" stroke="#C18C83" stroke-opacity="0.38" stroke-width="1.2" />
          </svg>
        </div>
      </div>
    </div>
  `;
}

export function renderEnvelopeSidePineSvg() {
  return `
    <svg viewBox="0 0 150 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Agujas profundas -->
      <g stroke="#1b2c25" stroke-width="2.4" stroke-linecap="round">
        <path d="M116 70L88 34M100 65L70 28M84 59L52 22M68 52L36 17M52 44L20 13" />
        <path d="M116 70L84 90M100 65L66 84M84 59L48 77M68 52L32 68M52 44L18 56" />
        <path d="M112 84L86 116M94 88L68 120M76 94L50 126M58 101L34 130" />
      </g>
      <path d="M142 74C98 66 54 50 12 24" stroke="#292724" stroke-width="2.7" stroke-linecap="round" />
      <g stroke="#263B32" stroke-width="2" stroke-linecap="round">
        <path d="M110 68L82 36M94 63L64 30M78 57L46 24M62 50L30 18M46 42L14 14" />
        <path d="M112 68L78 88M96 63L60 82M80 57L42 75M64 50L26 66M48 42L14 54" />
      </g>
      <path d="M140 82C96 86 58 98 20 120" stroke="#292724" stroke-width="2.5" stroke-linecap="round" />
      <g stroke="#263B32" stroke-width="1.95" stroke-linecap="round">
        <path d="M108 85L74 72M90 89L56 78M72 95L38 86M54 102L22 96" />
        <path d="M108 85L82 114M90 89L64 118M72 95L46 124M54 102L30 128" />
      </g>
      <g stroke="#C6A46F" stroke-opacity="0.34" stroke-width="1" stroke-linecap="round">
        <path d="M94 63L66 32M62 50L32 20M90 89L66 116" />
      </g>
      <circle cx="104" cy="74" r="5.8" fill="#783441" />
      <circle cx="102.5" cy="72.5" r="1.5" fill="#F3EBDD" fill-opacity="0.55" />
      <circle cx="95" cy="83" r="5.2" fill="#632632" />
      <circle cx="112" cy="84" r="5.0" fill="#783441" />
    </svg>
  `;
}

export function renderVelvetRibbonWingSvg(uid = 'left') {
  return `
    <svg viewBox="0 0 210 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="velvetWingGrad-${uid}" x1="0%" y1="0%" x2="100%" y2="50%">
          <stop offset="0%" stop-color="#58212c" />
          <stop offset="45%" stop-color="#783441" />
          <stop offset="78%" stop-color="#8d404f" />
          <stop offset="100%" stop-color="#521e28" />
        </linearGradient>
      </defs>
      <path d="M208 42C168 20 132 24 98 56C68 84 36 92 2 84L16 106C52 112 84 100 114 72C142 46 172 44 208 64Z" fill="url(#velvetWingGrad-${uid})" />
      <path d="M206 43C168 22 132 26 99 57C69 85 37 92 6 85" stroke="#C18C83" stroke-opacity="0.4" stroke-width="1.1" />
    </svg>
  `;
}
