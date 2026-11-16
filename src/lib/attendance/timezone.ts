import { toZonedTime, format as formatZoned } from 'date-fns-tz';

export const IST_TIMEZONE = 'Asia/Kolkata';
export const US_EASTERN_TIMEZONE = 'America/New_York';

export interface DualTimeInfo {
  utcIso: string;
  istTime: string;       // e.g. "05:30 PM"
  istDate: string;       // e.g. "2026-10-30"
  istFull: string;       // e.g. "2026-10-30 17:30:00 IST"
  estTime: string;       // e.g. "08:00 AM"
  estDate: string;       // e.g. "2026-10-30"
  estFull: string;       // e.g. "2026-10-30 08:00:00 EDT"
  isDst: boolean;        // true if EDT (Daylight Saving Time), false if EST
  tzAbbreviation: 'EDT' | 'EST';
}

/**
 * Checks if a given date falls under US Daylight Saving Time (EDT)
 */
export function isUsDaylightSaving(date: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: US_EASTERN_TIMEZONE,
    timeZoneName: 'short',
  }).formatToParts(date);

  const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value;
  return tzPart === 'EDT';
}

/**
 * Formats a Date object into synchronized IST and US Eastern representations
 */
export function formatDualTime(date: Date | string | number | null): DualTimeInfo | null {
  if (!date) return null;
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;

  const istZoned = toZonedTime(d, IST_TIMEZONE);
  const estZoned = toZonedTime(d, US_EASTERN_TIMEZONE);

  const isDst = isUsDaylightSaving(d);
  const tzAbbr: 'EDT' | 'EST' = isDst ? 'EDT' : 'EST';

  return {
    utcIso: d.toISOString(),
    istTime: formatZoned(istZoned, 'hh:mm:ss a', { timeZone: IST_TIMEZONE }),
    istDate: formatZoned(istZoned, 'yyyy-MM-dd', { timeZone: IST_TIMEZONE }),
    istFull: formatZoned(istZoned, 'yyyy-MM-dd HH:mm:ss', { timeZone: IST_TIMEZONE }) + ' IST',
    estTime: formatZoned(estZoned, 'hh:mm:ss a', { timeZone: US_EASTERN_TIMEZONE }),
    estDate: formatZoned(estZoned, 'yyyy-MM-dd', { timeZone: US_EASTERN_TIMEZONE }),
    estFull: formatZoned(estZoned, 'yyyy-MM-dd HH:mm:ss', { timeZone: US_EASTERN_TIMEZONE }) + ` ${tzAbbr}`,
    isDst,
    tzAbbreviation: tzAbbr,
  };
}
