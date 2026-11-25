/**
 * MotionEngine — Sistema global de Motion Graphics, partículas en 3 planos,
 * parallax suave de cursor/scroll, Intersection Observer y pausa automática
 * al ocultar la pestaña o cuando prefers-reduced-motion está activo.
 */

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function isFinePointerDevice() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(pointer: fine) and (hover: hover)').matches
  );
}

/**
 * Controla globalmente la pausa de animaciones CSS cuando la pestaña no es visible.
 */
export function initGlobalVisibilityPause() {
  const sync = () => {
    document.documentElement.classList.toggle('motion-paused', document.hidden);
  };
  document.addEventListener('visibilitychange', sync);
  sync();
  return () => document.removeEventListener('visibilitychange', sync);
}

/**
 * Halo de luz cálida sutil que sigue al cursor suavemente solo en escritorio.
 */
export function initDesktopLightCursor() {
  if (prefersReducedMotion() || !isFinePointerDevice()) {
    return () => {};
  }

  let aura = document.getElementById('ma-pointer-aura');
  if (!aura) {
    aura = document.createElement('div');
    aura.id = 'ma-pointer-aura';
    aura.className = 'pointer-light-aura';
    aura.setAttribute('aria-hidden', 'true');
    document.body.appendChild(aura);
  }

  let targetX = window.innerWidth * 0.5;
  let targetY = window.innerHeight * 0.5;
  let currentX = targetX;
  let currentY = targetY;
  let active = false;
  let rafId = null;

  const tick = () => {
    if (document.hidden) {
      rafId = null;
      return;
    }
    currentX += (targetX - currentX) * 0.12;
    currentY += (targetY - currentY) * 0.12;
    aura.style.transform = `translate3d(${currentX - 180}px, ${currentY - 180}px, 0)`;

    const dist = Math.abs(targetX - currentX) + Math.abs(targetY - currentY);
    if (dist > 0.35 && active) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null;
    }
  };

  const onMove = (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
    if (!active) {
      active = true;
      aura.classList.add('pointer-light-aura--visible');
    }
    if (!rafId && !document.hidden) {
      rafId = requestAnimationFrame(tick);
    }
  };

  const onLeave = () => {
    active = false;
    aura.classList.remove('pointer-light-aura--visible');
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave, { passive: true });

  return () => {
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerleave', onLeave);
    if (rafId) cancelAnimationFrame(rafId);
  };
}

/**
 * Renderizador ligero en Canvas para la CAPA 3 (Partículas):
 * - Nieve en múltiples planos de profundidad (tamaño, velocidad y opacidad diferenciados)
 * - Partículas luminosas doradas (#C6A46F)
 * - Ocasionales micro-corazones sutiles o destellos de estrella
 * Sin reflows DOM, con límite de partículas adaptado a móvil y pausa automática al ocultar pestaña.
 */
export function attachAmbientParticles(canvas, { mode = 'hero' } = {}) {
  if (!canvas || prefersReducedMotion()) {
    return () => {};
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const isMobile = window.innerWidth < 768;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  let width = 0;
  let height = 0;
  let particles = [];
  let rafId = null;
  let lastTime = performance.now();

  const createParticle = (initialRandomY = false) => {
    // 3 planos de profundidad: 0 = lejano, 1 = medio, 2 = cercano
    const depthRoll = Math.random();
    const depth = depthRoll < 0.45 ? 0 : depthRoll < 0.82 ? 1 : 2;

    if (mode === 'hero') {
      const isGoldMote = Math.random() < 0.24;
      return {
        kind: isGoldMote ? 'gold' : 'snow',
        depth,
        x: Math.random() * width,
        y: initialRandomY ? Math.random() * height : -12 - Math.random() * 40,
        r: isGoldMote
          ? 1.1 + depth * 0.75 + Math.random() * 0.9
          : 0.9 + depth * 0.95 + Math.random() * 0.8,
        vy: isGoldMote
          ? -(6 + depth * 5 + Math.random() * 6)
          : 12 + depth * 11 + Math.random() * 10,
        vx: (Math.random() - 0.5) * (6 + depth * 5),
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: 0.6 + Math.random() * 0.9,
        baseAlpha: isGoldMote
          ? 0.26 + depth * 0.16
          : 0.18 + depth * 0.15,
      };
    }

    if (mode === 'access') {
      const roll = Math.random();
      const kind = roll < 0.12 ? 'heart' : roll < 0.34 ? 'sparkle' : 'gold';
      return {
        kind,
        depth,
        x: Math.random() * width,
        y: initialRandomY ? Math.random() * height : height + 10 + Math.random() * 30,
        r: kind === 'heart' ? 3.5 + Math.random() * 1.8 : 1.1 + depth * 0.65 + Math.random() * 0.8,
        vy: -(7 + depth * 4 + Math.random() * 7),
        vx: (Math.random() - 0.5) * 8,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: 0.8 + Math.random() * 0.8,
        baseAlpha: kind === 'heart' ? 0.24 : 0.28 + depth * 0.14,
      };
    }

    // mode === 'calendar'
    const roll = Math.random();
    const kind = roll < 0.08 ? 'heart' : roll < 0.58 ? 'gold' : 'snow';
    return {
      kind,
      depth,
      x: Math.random() * width,
      y: initialRandomY ? Math.random() * height : kind === 'snow' ? -10 : height + 10,
      r: kind === 'heart' ? 3.2 + Math.random() * 1.4 : 1 + depth * 0.7 + Math.random() * 0.8,
      vy:
        kind === 'snow'
          ? 8 + depth * 7 + Math.random() * 7
          : -(5 + depth * 4 + Math.random() * 6),
      vx: (Math.random() - 0.5) * 6,
      phase: Math.random() * Math.PI * 2,
      phaseSpeed: 0.65 + Math.random() * 0.75,
      baseAlpha: kind === 'snow' ? 0.24 + depth * 0.12 : 0.24 + depth * 0.12,
    };
  };

  const targetCount = () => {
    if (mode === 'hero') return isMobile ? 28 : 54;
    if (mode === 'access') return isMobile ? 16 : 28;
    return isMobile ? 18 : 32;
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const desired = targetCount();
    if (particles.length === 0) {
      particles = Array.from({ length: desired }, () => createParticle(true));
    } else if (particles.length > desired) {
      particles.length = desired;
    } else {
      while (particles.length < desired) {
        particles.push(createParticle(true));
      }
    }
  };

  const drawTinyHeart = (x, y, size, alpha) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 8, size / 8);
    ctx.beginPath();
    ctx.moveTo(0, 2.5);
    ctx.bezierCurveTo(-5, -1.5, -5.5, -5.5, -2.5, -5.5);
    ctx.bezierCurveTo(-1, -5.5, 0, -4.2, 0, -3.2);
    ctx.bezierCurveTo(0, -4.2, 1, -5.5, 2.5, -5.5);
    ctx.bezierCurveTo(5.5, -5.5, 5, -1.5, 0, 2.5);
    ctx.closePath();
    ctx.fillStyle = `rgba(193, 140, 131, ${alpha})`;
    ctx.fill();
    ctx.restore();
  };

  const drawSparkle = (x, y, size, alpha) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = `rgba(198, 164, 111, ${alpha})`;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-size * 1.8, 0);
    ctx.lineTo(size * 1.8, 0);
    ctx.moveTo(0, -size * 1.8);
    ctx.lineTo(0, size * 1.8);
    ctx.stroke();
    ctx.restore();
  };

  const frame = (now) => {
    if (document.hidden) {
      rafId = null;
      return;
    }

    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.phase += p.phaseSpeed * dt;
      p.x += (p.vx + Math.sin(p.phase) * (5 + p.depth * 3)) * dt;
      p.y += p.vy * dt;

      if (p.vy > 0 && p.y > height + 16) {
        particles[i] = createParticle(false);
        particles[i].y = -12;
        continue;
      }
      if (p.vy < 0 && p.y < -16) {
        particles[i] = createParticle(false);
        particles[i].y = height + 12;
        continue;
      }
      if (p.x < -20) p.x = width + 16;
      if (p.x > width + 20) p.x = -16;

      const twinkle = 0.65 + 0.35 * Math.sin(p.phase * 1.6);
      const alpha = Math.min(0.85, p.baseAlpha * twinkle);

      if (p.kind === 'heart') {
        drawTinyHeart(p.x, p.y, p.r, alpha);
      } else if (p.kind === 'sparkle') {
        drawSparkle(p.x, p.y, p.r, alpha);
      } else if (p.kind === 'gold') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(198, 164, 111, ${alpha})`;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle =
          mode === 'calendar'
            ? `rgba(255, 252, 245, ${alpha})`
            : `rgba(243, 235, 221, ${alpha})`;
        ctx.fill();
      }
    }

    rafId = requestAnimationFrame(frame);
  };

  const onVisibility = () => {
    if (!document.hidden && !rafId) {
      lastTime = performance.now();
      rafId = requestAnimationFrame(frame);
    }
  };

  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  resize();

  document.addEventListener('visibilitychange', onVisibility);
  rafId = requestAnimationFrame(frame);

  return () => {
    ro.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    if (rafId) cancelAnimationFrame(rafId);
  };
}

/**
 * Conecta parallax suave por movimiento del cursor (escritorio) y scroll natural
 * sobre cualquier elemento con atributo `data-parallax-depth` y/o `data-scroll-depth`.
 */
export function attachDepthParallax(rootEl) {
  if (!rootEl || prefersReducedMotion()) {
    return () => {};
  }

  const pointerNodes = Array.from(
    rootEl.querySelectorAll('[data-parallax-depth]')
  );
  const scrollNodes = Array.from(
    rootEl.querySelectorAll('[data-scroll-depth]')
  );

  let targetNx = 0;
  let targetNy = 0;
  let curNx = 0;
  let curNy = 0;
  let rafId = null;

  const applyTransforms = () => {
    if (document.hidden) {
      rafId = null;
      return;
    }

    curNx += (targetNx - curNx) * 0.08;
    curNy += (targetNy - curNy) * 0.08;

    const scrollY = window.scrollY || 0;

    for (const el of pointerNodes) {
      const depth = Number(el.getAttribute('data-parallax-depth')) || 0;
      const scrollDepth = Number(el.getAttribute('data-scroll-depth')) || 0;
      const px = curNx * depth * 28;
      const py = curNy * depth * 18 + scrollY * scrollDepth;
      el.style.setProperty('--parallax-x', `${px.toFixed(2)}px`);
      el.style.setProperty('--parallax-y', `${py.toFixed(2)}px`);
    }

    for (const el of scrollNodes) {
      if (el.hasAttribute('data-parallax-depth')) continue;
      const scrollDepth = Number(el.getAttribute('data-scroll-depth')) || 0;
      const py = scrollY * scrollDepth;
      el.style.setProperty('--parallax-y', `${py.toFixed(2)}px`);
    }

    const delta = Math.abs(targetNx - curNx) + Math.abs(targetNy - curNy);
    if (delta > 0.002) {
      rafId = requestAnimationFrame(applyTransforms);
    } else {
      rafId = null;
    }
  };

  const schedule = () => {
    if (!rafId && !document.hidden) {
      rafId = requestAnimationFrame(applyTransforms);
    }
  };

  const onPointerMove = (e) => {
    targetNx = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
    targetNy = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
    schedule();
  };

  const onPointerLeave = () => {
    targetNx = 0;
    targetNy = 0;
    schedule();
  };

  const onScroll = () => {
    schedule();
  };

  const finePointer = isFinePointerDevice();
  if (finePointer && pointerNodes.length > 0) {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave, { passive: true });
  }
  if (scrollNodes.length > 0) {
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  schedule();

  return () => {
    if (finePointer) {
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
    }
    window.removeEventListener('scroll', onScroll);
    if (rafId) cancelAnimationFrame(rafId);
  };
}

/**
 * Observa elementos con `[data-reveal]` para revelarlos suavemente al entrar en pantalla.
 */
export function attachScrollReveals(rootEl) {
  const nodes = Array.from(rootEl.querySelectorAll('[data-reveal]'));
  if (nodes.length === 0) return () => {};

  if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
    for (const node of nodes) {
      node.classList.add('is-revealed');
    }
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      }
    },
    {
      threshold: 0.08,
      rootMargin: '0px 0px -24px 0px',
    }
  );

  for (const node of nodes) {
    observer.observe(node);
  }

  return () => observer.disconnect();
}

/**
 * Ejecuta una transición cinematográfica de cámara entre secciones sin cortes bruscos.
 */
export function runCinematicTransition(onMidpoint, { tone = 'warm' } = {}) {
  if (prefersReducedMotion()) {
    onMidpoint();
    return;
  }

  let veil = document.getElementById('ma-cinema-veil');
  if (!veil) {
    veil = document.createElement('div');
    veil.id = 'ma-cinema-veil';
    veil.className = 'cinema-transition-veil';
    veil.setAttribute('aria-hidden', 'true');
    document.body.appendChild(veil);
  }

  const appRoot = document.getElementById('app-root');
  veil.dataset.tone = tone;
  appRoot?.classList.add('cinema-camera-push');
  veil.classList.add('cinema-transition-veil--enter');

  setTimeout(() => {
    onMidpoint();
    appRoot?.classList.remove('cinema-camera-push');
    appRoot?.classList.add('cinema-camera-arrive');
    veil.classList.remove('cinema-transition-veil--enter');
    veil.classList.add('cinema-transition-veil--exit');

    setTimeout(() => {
      veil.classList.remove('cinema-transition-veil--exit');
      appRoot?.classList.remove('cinema-camera-arrive');
    }, 480);
  }, 340);
}
