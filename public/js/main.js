import { AuthenticationProvider } from './providers/AuthenticationProvider.js';
import { CalendarProvider } from './providers/CalendarProvider.js';
import {
  initDesktopLightCursor,
  initGlobalVisibilityPause,
} from './motion/MotionEngine.js';
import { mountHeroSection } from './components/HeroSection.js';
import { mountPrivateAccess } from './components/PrivateAccess.js';
import { mountAdventCalendar } from './components/AdventCalendar.js';

function readBootstrapPayload() {
  const el = document.getElementById('ma-bootstrap');
  if (!el || !el.textContent) {
    return {
      initialAuthenticated: false,
      initialServerConfigured: true,
      initialStage: 'hero',
    };
  }
  try {
    return JSON.parse(el.textContent);
  } catch {
    return {
      initialAuthenticated: false,
      initialServerConfigured: true,
      initialStage: 'hero',
    };
  }
}

function initExperience() {
  const root = document.getElementById('app-root');
  if (!root) return;

  // Sistema global de optimización y halo de luz en escritorio
  initGlobalVisibilityPause();
  initDesktopLightCursor();

  const bootstrap = readBootstrapPayload();
  const authProvider = new AuthenticationProvider(bootstrap);
  const calendarProvider = new CalendarProvider(authProvider);

  /** @type {(() => void) | null} */
  let currentCleanup = null;
  let mountedStage = null;

  const mountStage = (stage, isAuthenticated) => {
    const effectiveStage =
      stage === 'calendar' && !isAuthenticated ? 'access' : stage;

    if (mountedStage === effectiveStage) {
      return;
    }

    if (currentCleanup) {
      currentCleanup();
      currentCleanup = null;
    }

    if (!isAuthenticated) {
      calendarProvider.reset();
    }

    mountedStage = effectiveStage;

    if (effectiveStage === 'calendar') {
      currentCleanup = mountAdventCalendar(root, {
        authProvider,
        calendarProvider,
      });
    } else if (effectiveStage === 'access') {
      currentCleanup = mountPrivateAccess(root, { authProvider });
    } else {
      currentCleanup = mountHeroSection(root, { authProvider });
    }
  };

  authProvider.subscribe((state) => {
    mountStage(state.activeStage, state.isAuthenticated);
  });

  window.addEventListener('popstate', () => {
    authProvider.handlePopState(window.location.pathname, window.location.search);
  });

  const initial = authProvider.getState();
  mountStage(initial.activeStage, initial.isAuthenticated);
}

initExperience();
