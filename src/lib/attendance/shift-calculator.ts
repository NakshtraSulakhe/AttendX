import { toZonedTime, fromZonedTime, format as formatZoned } from 'date-fns-tz';

export interface ShiftInfo {
  id?: bigint;
  name: string;
  code: string;
  isOvernight: boolean;
  startTimeLocal: string; // e.g. "17:30:00" or "10:00:00"
  endTimeLocal: string;   // e.g. "02:30:00" or "19:00:00"
  timezone: string;       // e.g. "Asia/Kolkata"
  durationMinutes: number;// e.g. 540 (9 hours)
  graceLateMinutes: number;     // e.g. 15 mins
  graceEarlyExitMinutes: number;// e.g. 15 mins
  overtimeMinMinutes: number;   // e.g. 30 mins
}

export const DEFAULT_OVERNIGHT_SHIFT: ShiftInfo = {
  name: 'US Operations Overnight Shift',
  code: 'US_OVERNIGHT_IST',
  isOvernight: true,
  startTimeLocal: '17:30:00',
  endTimeLocal: '02:30:00',
  timezone: 'Asia/Kolkata',
  durationMinutes: 540, // 9 hours
  graceLateMinutes: 15,
  graceEarlyExitMinutes: 15,
  overtimeMinMinutes: 30,
};

export const DEFAULT_DAY_SHIFT: ShiftInfo = {
  name: 'Day General Shift',
  code: 'DAY_GENERAL_IST',
  isOvernight: false,
  startTimeLocal: '10:00:00',
  endTimeLocal: '19:00:00',
  timezone: 'Asia/Kolkata',
  durationMinutes: 540, // 9 hours
  graceLateMinutes: 15,
  graceEarlyExitMinutes: 15,
  overtimeMinMinutes: 30,
};

/**
 * Parses time string "HH:mm:ss" or "HH:mm" to total minutes from midnight
 */
export function timeStringToMinutes(timeStr: string): number {
  const parts = timeStr.split(':').map((p) => parseInt(p, 10));
  return parts[0] * 60 + (parts[1] || 0);
}

/**
 * Calculates accurate UTC start and end bounds for a shift on a given business date
 */
export function getShiftWindowUtc(
  businessDateStr: string,
  shift: ShiftInfo = DEFAULT_OVERNIGHT_SHIFT
): { windowStart: Date; windowEnd: Date } {
  const tz = shift.timezone || 'Asia/Kolkata';

  if (shift.isOvernight) {
    // 12:00 PM local noon on businessDate to 12:00 PM local noon next day
    const [y, m, d] = businessDateStr.split('-').map(Number);
    const nextDate = new Date(Date.UTC(y, m - 1, d + 1));
    const nextY = nextDate.getUTCFullYear();
    const nextM = String(nextDate.getUTCMonth() + 1).padStart(2, '0');
    const nextD = String(nextDate.getUTCDate()).padStart(2, '0');
    const nextDayStr = `${nextY}-${nextM}-${nextD}`;

    const windowStart = fromZonedTime(`${businessDateStr} 12:00:00`, tz);
    const windowEnd = fromZonedTime(`${nextDayStr} 12:00:00`, tz);
    return { windowStart, windowEnd };
  } else {
    const windowStart = fromZonedTime(`${businessDateStr} 00:00:00`, tz);
    const windowEnd = fromZonedTime(`${businessDateStr} 23:59:59.999`, tz);
    return { windowStart, windowEnd };
  }
}

/**
 * Formats a Date object to YYYY-MM-DD string in a specific timezone
 */
export function getBusinessDateString(date: Date, shift: ShiftInfo): string {
  const zonedDate = toZonedTime(date, shift.timezone);
  const hours = zonedDate.getHours();
  const minutes = zonedDate.getMinutes();
  const currentMinutesFromMidnight = hours * 60 + minutes;

  if (shift.isOvernight) {
    const endMinutes = timeStringToMinutes(shift.endTimeLocal);
    // Buffer cutoff (e.g. up to 10:00 AM) still belongs to previous business day
    const cutoffMinutes = Math.min(endMinutes + 180, 12 * 60); // 3 hours after shift end or noon

    if (currentMinutesFromMidnight < cutoffMinutes) {
      // It's after midnight (00:00 to 05:30/10:00), belongs to PREVIOUS day's shift
      const previousDay = new Date(zonedDate.getTime() - 24 * 60 * 60 * 1000);
      return formatZoned(previousDay, 'yyyy-MM-dd', { timeZone: shift.timezone });
    }
  }

  // Day shift or overnight shift before midnight belongs to calendar date
  return formatZoned(zonedDate, 'yyyy-MM-dd', { timeZone: shift.timezone });
}

export interface AttendanceCalculationResult {
  businessDate: string; // YYYY-MM-DD
  firstInTime: Date | null;
  lastOutTime: Date | null;
  totalWorkMinutes: number;
  lateMinutes: number;
  earlyExitMinutes: number;
  overtimeMinutes: number;
  status: 'PRESENT' | 'LATE' | 'EARLY_EXIT' | 'HALF_DAY' | 'ABSENT' | 'SHIFT_COMPLETED' | 'MISSING_OUT' | 'UNKNOWN';
  isInferred: boolean;
  notes: string;
}

/**
 * Calculates attendance metrics for a set of raw punches belonging to one business date
 */
export function calculateSessionMetrics(
  punches: Array<{ timeUtc: Date; attendanceStatus?: string; verifyMode?: string }>,
  shift: ShiftInfo,
  businessDateStr: string
): AttendanceCalculationResult {
  if (punches.length === 0) {
    return {
      businessDate: businessDateStr,
      firstInTime: null,
      lastOutTime: null,
      totalWorkMinutes: 0,
      lateMinutes: 0,
      earlyExitMinutes: 0,
      overtimeMinutes: 0,
      status: 'ABSENT',
      isInferred: false,
      notes: 'No punches recorded for shift date',
    };
  }

  // Sort chronologically
  const sortedPunches = [...punches].sort((a, b) => a.timeUtc.getTime() - b.timeUtc.getTime());

  const firstPunch = sortedPunches[0];
  const lastPunch = sortedPunches.length > 1 ? sortedPunches[sortedPunches.length - 1] : null;

  const firstInTime = firstPunch.timeUtc;
  const lastOutTime = lastPunch ? lastPunch.timeUtc : null;

  // Calculate local times
  const inZoned = toZonedTime(firstInTime, shift.timezone);
  const inMinutes = inZoned.getHours() * 60 + inZoned.getMinutes();
  const shiftStartMinutes = timeStringToMinutes(shift.startTimeLocal);

  let lateMinutes = 0;
  if (shift.isOvernight) {
    // For overnight (e.g. 17:30 start = 1050 mins)
    if (inMinutes > shiftStartMinutes + shift.graceLateMinutes && inMinutes < 24 * 60) {
      lateMinutes = inMinutes - shiftStartMinutes;
    }
  } else {
    // For day shift (e.g. 10:00 start = 600 mins)
    if (inMinutes > shiftStartMinutes + shift.graceLateMinutes) {
      lateMinutes = inMinutes - shiftStartMinutes;
    }
  }

  let totalWorkMinutes = 0;
  let earlyExitMinutes = 0;
  let overtimeMinutes = 0;
  let status: AttendanceCalculationResult['status'] = 'PRESENT';
  let notes = '';

  if (lastOutTime && lastOutTime.getTime() > firstInTime.getTime()) {
    const diffMs = lastOutTime.getTime() - firstInTime.getTime();
    totalWorkMinutes = Math.floor(diffMs / (1000 * 60));

    // Calculate early exit and overtime
    if (totalWorkMinutes < shift.durationMinutes - shift.graceEarlyExitMinutes) {
      earlyExitMinutes = shift.durationMinutes - totalWorkMinutes;
      status = 'EARLY_EXIT';
      notes = `Left early by ${earlyExitMinutes} mins`;
    } else if (totalWorkMinutes >= shift.durationMinutes + shift.overtimeMinMinutes) {
      overtimeMinutes = totalWorkMinutes - shift.durationMinutes;
      status = 'SHIFT_COMPLETED';
      notes = `Overtime completed: ${overtimeMinutes} mins`;
    } else {
      status = 'SHIFT_COMPLETED';
      notes = 'Completed full shift';
    }
  } else {
    // Only one punch recorded so far
    status = lateMinutes > 0 ? 'LATE' : 'PRESENT';
    notes = 'In progress / Pending check-out punch';
  }

  if (lateMinutes > 0 && status === 'PRESENT') {
    status = 'LATE';
    notes = `Late arrival by ${lateMinutes} mins`;
  }

  return {
    businessDate: businessDateStr,
    firstInTime,
    lastOutTime,
    totalWorkMinutes,
    lateMinutes,
    earlyExitMinutes,
    overtimeMinutes,
    status,
    isInferred: sortedPunches.length === 1,
    notes,
  };
}
