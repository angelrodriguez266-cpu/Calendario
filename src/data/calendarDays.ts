import type {
  DayCardIconType,
  DaySurpriseDefinition,
  SpecialMilestone,
} from '../types/calendar.ts';

/**
 * Íconos editoriales discretos asignados a cada día cuando está desbloqueado o activo.
 * El día 25 siempre conserva su estrella navideña especial y el día 31 su emblema de cierre.
 */
const ICON_ROTATION: DayCardIconType[] = [
  'pine',
  'gift',
  'heart',
  'letter',
  'sparkle',
];

function getDefaultIconForDay(day: number): DayCardIconType {
  if (day === 25) return 'star-christmas';
  if (day === 31) return 'finale-crown';
  return ICON_ROTATION[(day - 1) % ICON_ROTATION.length];
}

function getSpecialMilestone(day: number): SpecialMilestone {
  if (day === 25) return 'christmas';
  if (day === 31) return 'finale';
  return null;
}

/**
 * ESTRUCTURA DE DATOS DE LOS 31 DÍAS — DICIEMBRE DE 2026 (SOLO SERVIDOR)
 * ----------------------------------------------------------------------------
 * Este módulo reside exclusivamente en `src/data/` del servidor Node.js.
 * Ningún título ni contenido personal de días futuros se envía al navegador
 * antes de autenticarse y cumplirse las 00:00 (America/Bogota) de cada fecha.
 *
 * Para configurar la sorpresa de un día más adelante, añade una entrada en
 * `CUSTOM_SURPRISES_BY_DAY[numeroDeDia]`:
 *
 *   1: {
 *     isConfigured: true,
 *     contentType: 'letter', // 'letter' | 'photo' | 'video' | 'audio' | 'coupon' | 'mixed'
 *     title: 'Título especial del día 1',
 *     bodyParagraphs: ['Primer párrafo...', 'Segundo párrafo...'],
 *     signature: 'Con todo mi amor, Ángel',
 *     mediaAssets: [
 *       {
 *         id: 'foto-1',
 *         kind: 'image',
 *         filename: 'recuerdo.jpg', // archivo guardado en private-content/day-01/recuerdo.jpg
 *         mimeType: 'image/jpeg',
 *       },
 *     ],
 *   }
 */
const CUSTOM_SURPRISES_BY_DAY: Partial<
  Record<number, Partial<Omit<DaySurpriseDefinition, 'day' | 'dateLabel'>>>
> = {
  // Inicialmente todos los días permanecen en estado provisional (`isConfigured: false`)
  // sin inventar contenidos personales.
};

export const CALENDAR_DAYS_2026: DaySurpriseDefinition[] = Array.from(
  { length: 31 },
  (_, index) => {
    const day = index + 1;
    const custom = CUSTOM_SURPRISES_BY_DAY[day] ?? {};

    return {
      day,
      dateLabel: `${day} de diciembre de 2026`,
      cardIcon: custom.cardIcon ?? getDefaultIconForDay(day),
      specialMilestone: custom.specialMilestone ?? getSpecialMilestone(day),
      isConfigured: custom.isConfigured ?? false,
      contentType: custom.contentType ?? 'pending',
      title: custom.title,
      subtitle: custom.subtitle,
      bodyParagraphs: custom.bodyParagraphs,
      signature: custom.signature,
      mediaAssets: custom.mediaAssets,
    };
  }
);

export function getDayDefinition(day: number): DaySurpriseDefinition | undefined {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return undefined;
  }
  return CALENDAR_DAYS_2026[day - 1];
}
