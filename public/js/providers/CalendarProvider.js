const VISITED_SESSION_KEY = 'ma_visited_days_2026';

/**
 * CalendarProvider
 * Sincroniza los 31 días de diciembre de 2026 con el reloj oficial del servidor
 * en la zona horaria America/Bogota y escucha eventos en tiempo real (SSE +
 * temporizador exacto de medianoche) para desbloquear cada día a las 00:00
 * sin necesidad de recargar la página.
 */
export class CalendarProvider {
  /**
   * @param {import('./AuthenticationProvider.js').AuthenticationProvider} authProvider
   */
  constructor(authProvider) {
    this.authProvider = authProvider;

    this.state = {
      days: [],
      clock: null,
      isLoadingCalendar: false,
      calendarError: null,
      selectedDayDetail: null,
      isLoadingDayDetail: false,
      dayDetailError: null,
      visitedDays: this.loadVisitedDays(),
      newlyUnlockedDay: null,
    };

    /** @type {Set<number>} */
    this.previousLockedSet = new Set();
    /** @type {Set<(state: typeof this.state) => void>} */
    this.listeners = new Set();
    /** @type {EventSource | null} */
    this.eventSource = null;
    this.midnightTimer = null;
    this.visibilityHandler = () => {
      if (
        document.visibilityState === 'visible' &&
        this.authProvider.getState().isAuthenticated
      ) {
        void this.refreshCalendar();
      }
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  loadVisitedDays() {
    try {
      const raw = window.sessionStorage.getItem(VISITED_SESSION_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(parsed.filter((n) => typeof n === 'number'));
      }
    } catch {
      // Ignorar restricciones de sessionStorage
    }
    return new Set();
  }

  markVisited(dayNumber) {
    this.state.visitedDays.add(dayNumber);
    try {
      window.sessionStorage.setItem(
        VISITED_SESSION_KEY,
        JSON.stringify(Array.from(this.state.visitedDays))
      );
    } catch {
      // Sin impacto funcional
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    for (const listener of this.listeners) {
      listener(this.getState());
    }
  }

  getState() {
    return {
      ...this.state,
      visitedDays: new Set(this.state.visitedDays),
    };
  }

  applyOverviewPayload(data) {
    if (this.previousLockedSet.size > 0 && Array.isArray(data.days)) {
      const unlockedNow = data.days.find(
        (d) => d.state !== 'locked' && this.previousLockedSet.has(d.day)
      );
      if (unlockedNow) {
        this.state.newlyUnlockedDay = unlockedNow.day;
        setTimeout(() => {
          if (this.state.newlyUnlockedDay === unlockedNow.day) {
            this.state.newlyUnlockedDay = null;
            this.emit();
          }
        }, 4800);
      }
    }

    this.previousLockedSet = new Set(
      (data.days || []).filter((d) => d.state === 'locked').map((d) => d.day)
    );

    this.state.days = data.days || [];
    this.state.clock = data.clock || null;
    this.state.isLoadingCalendar = false;
    this.state.calendarError = null;

    this.scheduleMidnightSync();
    this.emit();
  }

  scheduleMidnightSync() {
    if (this.midnightTimer) {
      clearTimeout(this.midnightTimer);
      this.midnightTimer = null;
    }
    if (!this.state.clock || !this.authProvider.getState().isAuthenticated) {
      return;
    }

    const delayMs = Math.min(
      (this.state.clock.msUntilNextMidnight || 60_000) + 350,
      60 * 60 * 1000
    );

    this.midnightTimer = setTimeout(() => {
      void this.refreshCalendar();
    }, delayMs);
  }

  connectRealtimeStream() {
    if (this.eventSource || !this.authProvider.getState().isAuthenticated) {
      return;
    }

    try {
      const es = new EventSource('/api/calendar/stream', {
        withCredentials: true,
      });

      es.addEventListener('calendar-sync', (event) => {
        try {
          const parsed = JSON.parse(event.data);
          this.applyOverviewPayload(parsed);
        } catch {
          // Ignorar payload inválido
        }
      });

      es.onerror = () => {
        es.close();
        this.eventSource = null;
      };

      this.eventSource = es;
    } catch {
      // Fallback automático mediante scheduleMidnightSync()
    }
  }

  disconnectRealtimeStream() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.midnightTimer) {
      clearTimeout(this.midnightTimer);
      this.midnightTimer = null;
    }
  }

  reset() {
    this.disconnectRealtimeStream();
    this.previousLockedSet.clear();
    this.state.days = [];
    this.state.clock = null;
    this.state.selectedDayDetail = null;
    this.state.dayDetailError = null;
    this.state.newlyUnlockedDay = null;
  }

  async refreshCalendar() {
    if (!this.authProvider.getState().isAuthenticated) return;

    if (this.state.days.length === 0) {
      this.state.isLoadingCalendar = true;
      this.emit();
    }

    try {
      const res = await fetch('/api/calendar', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      });

      if (res.status === 401) {
        await this.authProvider.logout();
        return;
      }

      if (!res.ok) {
        throw new Error('Error sincronizando calendario');
      }

      const data = await res.json();
      this.applyOverviewPayload(data);
      this.connectRealtimeStream();
    } catch {
      this.state.isLoadingCalendar = false;
      this.state.calendarError =
        'No pudimos sincronizar la hora oficial del calendario. Intenta nuevamente.';
      this.emit();
    }
  }

  async openDaySurprise(dayNumber) {
    const target = this.state.days.find((d) => d.day === dayNumber);
    if (!target || target.state === 'locked') {
      return;
    }

    this.state.isLoadingDayDetail = true;
    this.state.dayDetailError = null;
    this.state.selectedDayDetail = null;
    this.emit();

    try {
      const res = await fetch(`/api/calendar/${dayNumber}`, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      });

      if (res.status === 401) {
        await this.authProvider.logout();
        return;
      }

      const payload = await res.json();
      if (!res.ok) {
        this.state.isLoadingDayDetail = false;
        this.state.dayDetailError =
          payload.error || 'Este día aún permanece bloqueado.';
        this.emit();
        await this.refreshCalendar();
        return;
      }

      this.markVisited(dayNumber);
      this.state.isLoadingDayDetail = false;
      this.state.selectedDayDetail = payload;
      this.emit();
    } catch {
      this.state.isLoadingDayDetail = false;
      this.state.dayDetailError =
        'No fue posible abrir la sorpresa en este momento. Intenta nuevamente.';
      this.emit();
    }
  }

  closeDaySurprise() {
    if (!this.state.selectedDayDetail && !this.state.dayDetailError) return;
    this.state.selectedDayDetail = null;
    this.state.dayDetailError = null;
    this.emit();
  }
}
