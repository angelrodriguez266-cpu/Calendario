import type { BogotaClockSnapshot, DayUnlockState } from '../types/calendar.ts';

const BOGOTA_TIMEZONE = 'America/Bogota';

let devBaseRealMs: number | null = null;
let devBaseTargetIso: string | null = null;

function resolveEffectiveEpochMs(): { epochMs: number; isDevSimulated: boolean } {
  if (process.env.NODE_ENV !== 'production') {
    const devIso = process.env.CALENDAR_DEV_BOGOTA_ISO?.trim();
    if (devIso) {
      const parsedMs = Date.parse(devIso);
      if (!Number.isNaN(parsedMs)) {
        if (process.env.CALENDAR_DEV_BOGOTA_LIVE_TICK === 'true') {
          if (devBaseTargetIso !== devIso || devBaseRealMs === null) {
            devBaseTargetIso = devIso;
            devBaseRealMs = Date.now();
          }
          const elapsed = Date.now() - devBaseRealMs;
          return { epochMs: parsedMs + elapsed, isDevSimulated: true };
        }
        return { epochMs: parsedMs, isDevSimulated: true };
      }
    }
  }
  return { epochMs: Date.now(), isDevSimulated: false };
}

export function getBogotaClockSnapshot(): BogotaClockSnapshot {
  const { epochMs, isDevSimulated } = resolveEffectiveEpochMs();
  const instant = new Date(epochMs);

  const partsFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOGOTA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = partsFormatter.formatToParts(instant);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }

  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  const hour = Number(map.hour);
  const minute = Number(map.minute);
  const second = Number(map.second);
  const milliseconds = instant.getUTCMilliseconds();

  const secondsElapsedToday = hour * 3600 + minute * 60 + second;
  const msElapsedToday = secondsElapsedToday * 1000 + milliseconds;
  const msInDay = 24 * 60 * 60 * 1000;
  const msUntilNextMidnight = Math.max(400, msInDay - msElapsedToday);

  const formattedDateEs = new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TIMEZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(instant);

  const formattedTimeEs = new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(instant);

  let calendarPhase: BogotaClockSnapshot['calendarPhase'];
  if (year < 2026 || (year === 2026 && month < 12)) {
    calendarPhase = 'before_december';
  } else if (year === 2026 && month === 12) {
    calendarPhase = 'december_active';
  } else {
    calendarPhase = 'after_december';
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const bogotaIso = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}-05:00`;

  return {
    serverTimestampMs: epochMs,
    bogotaIso,
    formattedDateEs,
    formattedTimeEs,
    year,
    month,
    day,
    hour,
    minute,
    second,
    msUntilNextMidnight,
    calendarPhase,
    isDevSimulated,
  };
}

export function getDayUnlockState(
  dayNumber: number,
  clock: BogotaClockSnapshot = getBogotaClockSnapshot()
): DayUnlockState {
  if (clock.calendarPhase === 'before_december') {
    return 'locked';
  }

  if (clock.calendarPhase === 'after_december') {
    return 'unlocked';
  }

  if (dayNumber < clock.day) {
    return 'unlocked';
  }

  if (dayNumber === clock.day) {
    return 'today';
  }

  return 'locked';
}
