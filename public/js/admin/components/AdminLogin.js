import { adminFetchJson, escapeHtml } from '../adminApi.js';
import { lucide } from '../lucideIcons.js';

export function mountAdminLogin(container, { supabaseStatus, onAuthenticated }) {
  container.innerHTML = `
    <main class="admin-login-page">
      <section class="admin-login-card ivory-paper-surface" aria-labelledby="admin-login-title">
        <div class="admin-monogram-badge">
          <span>M&amp;A</span>
        </div>

        <h1 id="admin-login-title" class="admin-login-title">Panel de administración</h1>
        <p class="admin-login-subtitle">Gestiona nuestra historia</p>

        ${
          !supabaseStatus.configured
            ? `
              <div class="admin-alert admin-alert--warning" style="width:100%;margin-bottom:1.1rem;">
                <span>${lucide.alert}</span>
                <span>
                  <strong>Integración con Supabase pendiente:</strong> configura
                  <code>SUPABASE_URL</code>, <code>SUPABASE_PUBLISHABLE_KEY</code>,
                  <code>SUPABASE_SERVICE_ROLE_KEY</code> y <code>ADMIN_ALLOWED_EMAILS</code>
                  en <code>.env.local</code> y ejecuta las migraciones SQL de <code>supabase/migrations/</code>.
                </span>
              </div>
            `
            : ''
        }

        <form class="admin-login-form" id="admin-login-form" novalidate>
          <div class="admin-field">
            <label for="admin-email" class="admin-label">Correo electrónico</label>
            <div class="admin-input-wrap">
              ${lucide.mail}
              <input
                id="admin-email"
                type="email"
                class="admin-input"
                placeholder="tu-correo@ejemplo.com"
                autocomplete="username"
                required
              />
            </div>
          </div>

          <div class="admin-field">
            <label for="admin-password" class="admin-label">Contraseña</label>
            <div class="admin-input-wrap">
              ${lucide.lock}
              <input
                id="admin-password"
                type="password"
                class="admin-input"
                placeholder="Ingresa tu contraseña"
                autocomplete="current-password"
                required
              />
              <button
                type="button"
                id="admin-toggle-pwd"
                class="admin-eye-btn"
                aria-label="Mostrar contraseña"
                aria-pressed="false"
              >
                ${lucide.eye}
              </button>
            </div>
          </div>

          <div id="admin-login-error" class="admin-alert admin-alert--error" role="alert" hidden></div>

          <button type="submit" id="admin-login-submit" class="admin-btn admin-btn--primary admin-btn--full">
            <span>Iniciar sesión</span>
          </button>
        </form>
      </section>
    </main>
  `;

  const form = /** @type {HTMLFormElement} */ (container.querySelector('#admin-login-form'));
  const emailInput = /** @type {HTMLInputElement} */ (container.querySelector('#admin-email'));
  const pwdInput = /** @type {HTMLInputElement} */ (container.querySelector('#admin-password'));
  const toggleBtn = /** @type {HTMLButtonElement} */ (container.querySelector('#admin-toggle-pwd'));
  const errorBox = /** @type {HTMLElement} */ (container.querySelector('#admin-login-error'));
  const submitBtn = /** @type {HTMLButtonElement} */ (container.querySelector('#admin-login-submit'));

  let visible = false;

  toggleBtn.addEventListener('click', () => {
    visible = !visible;
    pwdInput.type = visible ? 'text' : 'password';
    toggleBtn.innerHTML = visible ? lucide.eyeOff : lucide.eye;
    toggleBtn.setAttribute('aria-pressed', String(visible));
    toggleBtn.setAttribute(
      'aria-label',
      visible ? 'Ocultar contraseña' : 'Mostrar contraseña'
    );
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    const password = pwdInput.value;

    if (!email || !password) {
      errorBox.innerHTML = `<span>${lucide.alert}</span><span>Completa tu correo electrónico y contraseña.</span>`;
      errorBox.hidden = false;
      return;
    }

    errorBox.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verificando acceso...';

    const res = await adminFetchJson('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok || !res.data.authenticated) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Iniciar sesión';
      errorBox.innerHTML = `<span>${lucide.alert}</span><span>${escapeHtml(
        res.data.message || 'No fue posible iniciar sesión.'
      )}</span>`;
      errorBox.hidden = false;
      return;
    }

    pwdInput.value = '';
    onAuthenticated(res.data.user);
  });
}
