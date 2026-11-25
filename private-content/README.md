# Contenido Privado de Sorpresas (`private-content/`)

Esta carpeta está **fuera de `public/`** de forma intencional para que ningún archivo privado (fotografías, cartas en PDF, audios o videos) pueda descargarse mediante una URL pública directa.

## Cómo añadir archivos más adelante

1. Crea la subcarpeta correspondiente al día con dos dígitos: `day-01`, `day-02`, ..., `day-31`.
2. Guarda el archivo dentro de esa carpeta (por ejemplo: `private-content/day-03/carta.pdf`).
3. Registra el recurso en `src/data/calendarDays.ts` dentro de `mediaAssets`.

El endpoint `/api/calendar/[day]/asset/[filename]` verificará automáticamente en el servidor:
- Que exista una sesión autenticada válida (`HttpOnly` firmada con HMAC-SHA256).
- Que el día ya se haya desbloqueado según la hora oficial en `America/Bogota`.
