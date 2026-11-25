export interface InitialAppBootstrap {
  initialAuthenticated: boolean;
  initialServerConfigured: boolean;
  initialStage: 'hero' | 'access' | 'calendar';
}

export function renderHtmlShell(bootstrap: InitialAppBootstrap): string {
  const safeJson = JSON.stringify(bootstrap).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="theme-color" content="#292724" />
    <title>María y Ángel: una Navidad juntos</title>
    <meta
      name="description"
      content="Calendario de Adviento digital privado — 31 días, 31 pequeños detalles y una historia que sigue escribiéndose."
    />

    <!-- Google Fonts oficiales: Bodoni Moda, DM Sans y Allura -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Allura&family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..600&family=DM+Sans:ital,opsz,wght@0,9..40,300..600;1,9..40,400&display=swap"
      rel="stylesheet"
    />

    <!-- Sistema de estilos separado por responsabilidades y variables CSS -->
    <link rel="stylesheet" href="/styles/tokens.css" />
    <link rel="stylesheet" href="/styles/base.css" />
    <link rel="stylesheet" href="/styles/motion.css" />
    <link rel="stylesheet" href="/styles/decorative.css" />
    <link rel="stylesheet" href="/styles/hero.css" />
    <link rel="stylesheet" href="/styles/private-access.css" />
    <link rel="stylesheet" href="/styles/calendar.css" />
    <link rel="stylesheet" href="/styles/calendar-day.css" />
  </head>
  <body>
    <div id="app-root"></div>

    <script id="ma-bootstrap" type="application/json">${safeJson}</script>
    <script type="module" src="/js/main.js"></script>
  </body>
</html>`;
}
