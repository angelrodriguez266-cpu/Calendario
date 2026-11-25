import { adminFetchJson, escapeHtml } from './adminApi.js';
import { lucide } from './lucideIcons.js';
import { mountAdminLogin } from './components/AdminLogin.js';
import {
  mountAdminCalendarManager,
  mountAdminDashboard,
} from './components/AdminDashboard.js';
import { mountSurpriseEditor } from './components/SurpriseEditor.js';
import {
  mountAdminCoupons,
  mountAdminMedia,
  mountAdminSettings,
} from './components/AdminSections.js';

function readAdminBootstrap() {
  const el = document.getElementById('ma-admin-bootstrap');
  if (!el || !el.textContent) {
    return {
      authenticated: false,
      user: null,
      supabaseStatus: { configured: false },
      bogotaDateLabel: '',
    };
  }
  try {
    return JSON.parse(el.textContent);
  } catch {
    return {
      authenticated: false,
      user: null,
      supabaseStatus: { configured: false },
      bogotaDateLabel: '',
    };
  }
}

function showToast(message) {
  const existing = document.getElementById('admin-live-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'admin-live-toast';
  toast.className = 'admin-toast';
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3400);
}

function confirmDialog({ title, message, confirmLabel = 'Confirmar' }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'admin-modal-backdrop';
    backdrop.innerHTML = `
      <div class="admin-modal ivory-paper-surface" style="max-width:440px;">
        <h2 style="font-family:var(--font-serif);font-size:1.45rem;color:var(--color-borgona);margin-bottom:0.55rem;">${escapeHtml(title)}</h2>
        <p style="font-size:0.94rem;color:var(--negro-calido-80);margin-bottom:1.35rem;">${escapeHtml(message)}</p>
        <div style="display:flex;justify-content:flex-end;gap:0.65rem;">
          <button type="button" id="conf-cancel" class="admin-btn admin-btn--secondary">Cancelar</button>
          <button type="button" id="conf-ok" class="admin-btn admin-btn--danger">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    const close = (val) => {
      backdrop.remove();
      resolve(val);
    };
    backdrop.querySelector('#conf-cancel')?.addEventListener('click', () => close(false));
    backdrop.querySelector('#conf-ok')?.addEventListener('click', () => close(true));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close(false);
    });
  });
}

function initAdminApp() {
  const root = document.getElementById('admin-root');
  if (!root) return;

  const state = {
    ...readAdminBootstrap(),
    activeSection: 'dashboard',
    editingDay: 1,
    mobileMenuOpen: false,
  };

  let currentViewCleanup = null;

  const renderLoginView = () => {
    mountAdminLogin(root, {
      supabaseStatus: state.supabaseStatus,
      onAuthenticated: (user) => {
        state.authenticated = true;
        state.user = user;
        state.activeSection = 'dashboard';
        renderShell();
      },
    });
  };

  const renderSectionContent = async () => {
    if (typeof currentViewCleanup === 'function') {
      currentViewCleanup();
      currentViewCleanup = null;
    }

    const contentEl = /** @type {HTMLElement | null} */ (root.querySelector('#admin-view-slot'));
    if (!contentEl) return;

    const goToEditDay = (dayNum) => {
      state.editingDay = dayNum;
      state.activeSection = 'create';
      state.mobileMenuOpen = false;
      updateNavHighlight();
      void renderSectionContent();
    };

    const navigate = (section) => {
      state.activeSection = section;
      state.mobileMenuOpen = false;
      updateNavHighlight();
      void renderSectionContent();
    };

    if (state.activeSection === 'dashboard') {
      await mountAdminDashboard(contentEl, {
        onEditDay: goToEditDay,
        onNavigate: navigate,
      });
    } else if (state.activeSection === 'calendar') {
      await mountAdminCalendarManager(contentEl, {
        onEditDay: goToEditDay,
        showToast,
        confirmDialog,
      });
    } else if (state.activeSection === 'create') {
      currentViewCleanup = await mountSurpriseEditor(contentEl, {
        dayNumber: state.editingDay,
        onDayChange: (nextDay) => goToEditDay(nextDay),
        onSaved: () => {},
        onDeleted: () => navigate('calendar'),
        showToast,
        confirmDialog,
      });
    } else if (state.activeSection === 'media') {
      await mountAdminMedia(contentEl, { showToast, confirmDialog });
    } else if (state.activeSection === 'coupons') {
      await mountAdminCoupons(contentEl, { onEditDay: goToEditDay });
    } else if (state.activeSection === 'settings') {
      mountAdminSettings(contentEl, {
        user: state.user,
        supabaseStatus: state.supabaseStatus,
        bogotaDateLabel: state.bogotaDateLabel,
      });
    }
  };

  const updateNavHighlight = () => {
    root.querySelectorAll('[data-nav-section]').forEach((btn) => {
      const sec = btn.getAttribute('data-nav-section');
      btn.classList.toggle('admin-nav__item--active', sec === state.activeSection);
    });
    const sidebar = root.querySelector('#admin-sidebar');
    const backdrop = root.querySelector('#admin-sidebar-backdrop');
    sidebar?.classList.toggle('admin-sidebar--open', state.mobileMenuOpen);
    if (backdrop) /** @type {HTMLElement} */ (backdrop).hidden = !state.mobileMenuOpen;
  };

  const renderShell = () => {
    root.innerHTML = `
      <div class="admin-layout">
        <div class="admin-mobile-bar">
          <span style="font-family:var(--font-serif);font-size:1.15rem;">M&amp;A · Administración</span>
          <button type="button" id="admin-mobile-toggle" style="color:var(--color-marfil);padding:0.4rem;" aria-label="Abrir menú">
            ${lucide.menu}
          </button>
        </div>

        <div id="admin-sidebar-backdrop" class="admin-sidebar-backdrop" hidden></div>

        <aside id="admin-sidebar" class="admin-sidebar" aria-label="Navegación administrativa">
          <div class="admin-sidebar__brand">
            <div class="admin-sidebar__logo">
              <span class="admin-sidebar__monogram">M&amp;A</span>
              <span class="admin-sidebar__role">Panel privado</span>
            </div>
          </div>

          <nav class="admin-nav">
            <button type="button" class="admin-nav__item" data-nav-section="dashboard">${lucide.home}<span>Inicio</span></button>
            <button type="button" class="admin-nav__item" data-nav-section="calendar">${lucide.calendar}<span>Calendario</span></button>
            <button type="button" class="admin-nav__item" data-nav-section="create">${lucide.plusCircle}<span>Crear sorpresa</span></button>
            <button type="button" class="admin-nav__item" data-nav-section="media">${lucide.folder}<span>Archivos multimedia</span></button>
            <button type="button" class="admin-nav__item" data-nav-section="coupons">${lucide.ticket}<span>Cupones</span></button>
            <button type="button" class="admin-nav__item" data-nav-section="settings">${lucide.settings}<span>Configuración</span></button>
          </nav>

          <div class="admin-sidebar__footer">
            <div class="admin-sidebar__user" title="${escapeHtml(state.user?.email || '')}">
              ${escapeHtml(state.user?.email || 'Administrador')}
            </div>
            <button type="button" id="admin-logout-btn" class="admin-nav__item admin-nav__item--logout">
              ${lucide.logOut}<span>Cerrar sesión</span>
            </button>
          </div>
        </aside>

        <main class="admin-main ivory-paper-surface">
          <div id="admin-view-slot" class="admin-content"></div>
        </main>
      </div>
    `;

    root.querySelectorAll('[data-nav-section]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.activeSection = btn.getAttribute('data-nav-section') || 'dashboard';
        state.mobileMenuOpen = false;
        updateNavHighlight();
        void renderSectionContent();
      });
    });

    root.querySelector('#admin-mobile-toggle')?.addEventListener('click', () => {
      state.mobileMenuOpen = !state.mobileMenuOpen;
      updateNavHighlight();
    });

    root.querySelector('#admin-sidebar-backdrop')?.addEventListener('click', () => {
      state.mobileMenuOpen = false;
      updateNavHighlight();
    });

    root.querySelector('#admin-logout-btn')?.addEventListener('click', async () => {
      await adminFetchJson('/api/admin/auth/logout', { method: 'POST' });
      state.authenticated = false;
      state.user = null;
      renderLoginView();
    });

    updateNavHighlight();
    void renderSectionContent();
  };

  if (state.authenticated) {
    renderShell();
  } else {
    renderLoginView();
  }
}

initAdminApp();
