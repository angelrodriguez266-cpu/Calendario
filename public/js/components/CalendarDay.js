import {
  renderCheckMarkSvg,
  renderDayThematicIconSvg,
  renderPadlockSvg,
  renderRomanticHeartSvg,
} from './DecorativeElements.js';

/**
 * CalendarDay — Renderiza una tarjeta individual del calendario con sus 5 estados,
 * microinteracciones vivas, brillo de candado, partícula dorada del día actual
 * y detalles especiales del Día 25 (Navidad) y Día 31 (Cierre).
 */
export function renderCalendarDayHtml(
  item,
  { isVisited = false, isNewlyUnlocked = false, revealIndex = 0, alreadyRevealed = false } = {}
) {
  const isLocked = item.state === 'locked';
  const isToday = item.state === 'today';
  const isUnlocked = item.state === 'unlocked';
  const isChristmas = item.specialMilestone === 'christmas';
  const isFinale = item.specialMilestone === 'finale';

  const classes = [
    'calendar-day',
    isLocked ? 'calendar-day--locked' : 'calendar-day--interactive',
    isToday ? 'calendar-day--today' : '',
    isUnlocked ? 'calendar-day--unlocked' : '',
    isChristmas ? 'calendar-day--christmas' : '',
    isFinale ? 'calendar-day--finale' : '',
    isNewlyUnlocked ? 'calendar-day--unlocking' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const ariaLabel = isLocked
    ? `Día ${item.day} de diciembre, bloqueado hasta las 00:00 de su fecha`
    : isToday
      ? `Día ${item.day} de diciembre, disponible hoy. Haz clic para abrir su sorpresa`
      : `Día ${item.day} de diciembre, desbloqueado${isVisited ? ' y consultado' : ''}. Haz clic para volver a entrar`;

  let milestoneHtml = '';
  if (isChristmas) {
    milestoneHtml = `<span class="calendar-day__milestone">Navidad</span>`;
  } else if (isFinale) {
    milestoneHtml = `<span class="calendar-day__milestone">Cierre</span>`;
  }

  let badgeHtml = '';
  if (isUnlocked) {
    badgeHtml = `
      <span
        class="calendar-day__badge ${isVisited ? 'calendar-day__badge--visited' : ''}"
        title="${isVisited ? 'Sorpresa consultada' : 'Día desbloqueado'}"
      >
        ${renderCheckMarkSvg(11)}
      </span>
    `;
  } else if (isLocked && (isChristmas || isFinale)) {
    badgeHtml = `
      <span class="calendar-day__mini-lock">
        ${renderPadlockSvg({ size: 13 })}
      </span>
    `;
  }

  let specialAtmosphereHtml = '';
  if (isToday) {
    specialAtmosphereHtml += `<span class="calendar-day__gold-mote" aria-hidden="true"></span>`;
  }
  if (isChristmas) {
    specialAtmosphereHtml += `
      <span class="calendar-day__christmas-spark calendar-day__christmas-spark--a" aria-hidden="true">✦</span>
      <span class="calendar-day__christmas-spark calendar-day__christmas-spark--b" aria-hidden="true">✦</span>
    `;
  }
  if (isFinale) {
    specialAtmosphereHtml += `
      <span class="calendar-day__finale-spark calendar-day__finale-spark--a" aria-hidden="true"></span>
      <span class="calendar-day__finale-spark calendar-day__finale-spark--b" aria-hidden="true"></span>
    `;
  }

  const glintDelay = `${((item.day * 0.47) % 5.5).toFixed(2)}s`;

  let iconHtml = '';
  if (isLocked) {
    if (isChristmas) {
      iconHtml = renderDayThematicIconSvg('star-christmas', {
        size: 20,
        className: 'calendar-day__icon--christmas',
      });
    } else if (isFinale) {
      iconHtml = renderDayThematicIconSvg('finale-crown', {
        size: 20,
        className: 'calendar-day__icon--finale',
      });
    } else {
      iconHtml = renderPadlockSvg({
        size: 18,
        className: 'calendar-day__icon--locked',
      });
    }
  } else if (isToday) {
    if (isChristmas) {
      iconHtml = renderDayThematicIconSvg('star-christmas', {
        size: 22,
        className: 'calendar-day__icon--christmas',
      });
    } else if (isFinale) {
      iconHtml = renderDayThematicIconSvg('finale-crown', {
        size: 22,
        className: 'calendar-day__icon--finale',
      });
    } else {
      iconHtml = renderRomanticHeartSvg({
        size: 21,
        className: 'calendar-day__icon--today',
      });
    }
  } else {
    const colorClass = isChristmas
      ? 'calendar-day__icon--christmas'
      : isFinale
        ? 'calendar-day__icon--finale'
        : item.cardIcon === 'pine'
          ? 'calendar-day__icon--pine'
          : 'calendar-day__icon--burgundy';

    iconHtml = renderDayThematicIconSvg(item.cardIcon, {
      size: 20,
      className: colorClass,
    });
  }

  // Retraso escalonado ágil (módulo 7 para filas en scroll fluido sin demoras excesivas)
  const staggerMs = Math.min(revealIndex * 34, 720);

  return `
    <li
      class="advent-calendar__grid-item ${alreadyRevealed ? 'is-revealed' : ''}"
      data-reveal
      style="--reveal-delay:${staggerMs}ms;"
    >
      <button
        type="button"
        class="${classes}"
        data-day-number="${item.day}"
        data-locked="${isLocked ? 'true' : 'false'}"
        aria-disabled="${isLocked ? 'true' : 'false'}"
        aria-label="${ariaLabel}"
        style="--glint-delay:${glintDelay};"
      >
        ${milestoneHtml}
        ${badgeHtml}
        ${specialAtmosphereHtml}
        <span class="calendar-day__number">${item.day}</span>
        <span class="calendar-day__icon">${iconHtml}</span>
      </button>
    </li>
  `;
}
