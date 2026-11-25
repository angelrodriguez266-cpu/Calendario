/**
 * AuthenticationProvider
 * Gestiona el estado de autenticación validado exclusivamente en el servidor
 * mediante cookies HttpOnly firmadas y controla la transición entre etapas.
 * Nunca almacena contraseñas ni credenciales en localStorage o JavaScript.
 */
export class AuthenticationProvider {
  /**
   * @param {{ initialAuthenticated: boolean, initialServerConfigured: boolean, initialStage: 'hero' | 'access' | 'calendar' }} bootstrap
   */
  constructor(bootstrap) {
    this.state = {
      isAuthenticated: Boolean(bootstrap.initialAuthenticated),
      isServerConfigured: Boolean(bootstrap.initialServerConfigured),
      activeStage:
        bootstrap.initialStage === 'calendar' && !bootstrap.initialAuthenticated
          ? 'access'
          : bootstrap.initialStage || 'hero',
    };

    /** @type {Set<(state: typeof this.state, prevStage: string) => void>} */
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(prevStage) {
    for (const listener of this.listeners) {
      listener({ ...this.state }, prevStage);
    }
  }

  getState() {
    return { ...this.state };
  }

  async syncSession() {
    try {
      const res = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      const prevStage = this.state.activeStage;
      this.state.isAuthenticated = Boolean(data.authenticated);
      this.state.isServerConfigured = Boolean(data.configured);

      if (!this.state.isAuthenticated && this.state.activeStage === 'calendar') {
        this.state.activeStage = 'access';
        window.history.replaceState({ stage: 'access' }, '', '/?acceso=privado');
      }
      this.emit(prevStage);
    } catch {
      // Mantiene estado seguro
    }
  }

  goToHero() {
    const prevStage = this.state.activeStage;
    if (prevStage === 'hero') return;
    this.state.activeStage = 'hero';
    window.history.pushState({ stage: 'hero' }, '', '/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.emit(prevStage);
  }

  goToAccess() {
    const prevStage = this.state.activeStage;
    if (this.state.isAuthenticated) {
      this.state.activeStage = 'calendar';
      window.history.pushState({ stage: 'calendar' }, '', '/calendario');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.emit(prevStage);
      return;
    }
    if (prevStage === 'access') return;
    this.state.activeStage = 'access';
    window.history.pushState({ stage: 'access' }, '', '/?acceso=privado');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.emit(prevStage);
  }

  goToCalendarIfAuthenticated() {
    const prevStage = this.state.activeStage;
    if (!this.state.isAuthenticated) {
      this.state.activeStage = 'access';
      window.history.replaceState({ stage: 'access' }, '', '/?acceso=privado');
      this.emit(prevStage);
      return;
    }
    this.state.activeStage = 'calendar';
    window.history.pushState({ stage: 'calendar' }, '', '/calendario');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.emit(prevStage);
  }

  handlePopState(pathname, search) {
    const prevStage = this.state.activeStage;
    if (pathname.startsWith('/calendario')) {
      if (this.state.isAuthenticated) {
        this.state.activeStage = 'calendar';
      } else {
        this.state.activeStage = 'access';
        window.history.replaceState({ stage: 'access' }, '', '/?acceso=privado');
      }
    } else if (search.includes('acceso')) {
      this.state.activeStage = 'access';
    } else {
      this.state.activeStage = 'hero';
    }
    if (prevStage !== this.state.activeStage) {
      this.emit(prevStage);
    }
  }

  async loginWithPassword(password) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password }),
      });

      const payload = await res.json();
      if (!res.ok || !payload.authenticated) {
        if (payload.code === 'SERVER_NOT_CONFIGURED') {
          this.state.isServerConfigured = false;
        }
        return {
          ok: false,
          code: payload.code || 'AUTH_FAILED',
          message:
            payload.message || 'No fue posible validar la clave en este momento.',
        };
      }

      this.state.isAuthenticated = true;
      return { ok: true };
    } catch {
      return {
        ok: false,
        code: 'NETWORK_ERROR',
        message:
          'Error de conexión con el servidor. Verifica tu red e inténtalo de nuevo.',
      };
    }
  }

  async logout() {
    const prevStage = this.state.activeStage;
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } finally {
      this.state.isAuthenticated = false;
      this.state.activeStage = 'access';
      window.history.replaceState({ stage: 'access' }, '', '/?acceso=privado');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.emit(prevStage);
    }
  }
}
