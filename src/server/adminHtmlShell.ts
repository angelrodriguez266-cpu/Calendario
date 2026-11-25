import type { AdminSessionUser } from '../types/admin.ts';

export interface AdminBootstrapPayload {
  authenticated: boolean;
  user: AdminSessionUser | null;
  supabaseStatus: {
    configured: boolean;
    hasUrl: boolean;
    hasPublishableKey: boolean;
    hasServiceRoleKey: boolean;
    allowedEmailsCount: number;
  };
  bogotaDateLabel: string;
}

export function renderAdminHtmlShell(bootstrap: AdminBootstrapPayload): string {
  const safeJson = JSON.stringify(bootstrap).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="theme-color" content="#263B32" />
    <title>Panel de administración — M&amp;A</title>

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Allura&family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..600&family=DM+Sans:ital,opsz,wght@0,9..40,300..600;1,9..40,400&display=swap"
      rel="stylesheet"
    />

    <link rel="stylesheet" href="/styles/tokens.css" />
    <link rel="stylesheet" href="/styles/base.css" />
    <link rel="stylesheet" href="/styles/admin.css" />
  </head>
  <body class="admin-body">
    <div id="admin-root"></div>

    <script id="ma-admin-bootstrap" type="application/json">${safeJson}</script>
    <script type="module" src="/js/admin/adminMain.js"></script>
  </body>
</html>`;
}
