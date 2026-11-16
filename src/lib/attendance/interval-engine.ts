import { withTransaction } from '../db';
import { ShiftInfo, DEFAULT_OVERNIGHT_SHIFT } from './shift-calculator';

export interface PunchRecord {
  id: bigint;
  serialNo: number;
  timeUtc: Date;
  timeDevice: string;
  verifyMode?: string | null;
  attendanceStatus?: string | null;
  cardReaderNo?: number;
  minor?: number;
}

export interface ReconciledInterval {
  type: 'WORK' | 'BREAK';
  startTime: Date;
  endTime: Date | null;
  durationSeconds: number; // 0 if currently active
  startEventId: bigint;
  endEventId: bigint | null;
  isCompleted: boolean;
}

export interface ReconciledSessionMetrics {
  firstInTime: Date | null;
  lastInTime: Date | null;
  lastOutTime: Date | null;
  currentState: 'NOT_CHECKED_IN' | 'WORKING' | 'ON_BREAK' | 'COMPLETED' | 'MISSING_OUT' | 'FLAGGED';
  completionStatus: 'ACTIVE' | 'COMPLETED' | 'PENDING_CLOSURE' | 'AUTO_CLOSED';
  currentIntervalStart: Date | null;
  inCount: number;
  outCount: number;
  completedBreakCount: number;
  totalWorkingSeconds: number; // completed work intervals sum
  totalBreakSeconds: number;   // completed break intervals sum
  totalElapsedSeconds: number; // for completed session: lastOut - firstIn
  intervals: ReconciledInterval[];
  flaggedNotes?: string;
}

/**
 * Reconciles raw chronological punches into verified WORK and BREAK intervals
 * Debounces duplicate scans (<60s) and handles state-machine transitions
 */
export function reconcilePunchesToIntervals(
  punches: PunchRecord[],
  shift: ShiftInfo,
  nowUtc: Date = new Date()
): ReconciledSessionMetrics {
  if (punches.length === 0) {
    return {
      firstInTime: null,
      lastInTime: null,
      lastOutTime: null,
      currentState: 'NOT_CHECKED_IN',
      completionStatus: 'ACTIVE',
      currentIntervalStart: null,
      inCount: 0,
      outCount: 0,
      completedBreakCount: 0,
      totalWorkingSeconds: 0,
      totalBreakSeconds: 0,
      totalElapsedSeconds: 0,
      intervals: [],
    };
  }

  // 1. Sort chronologically
  const sorted = [...punches].sort((a, b) => a.timeUtc.getTime() - b.timeUtc.getTime());

  // 2. Debounce duplicate scans within 45 seconds
  const debounced: PunchRecord[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    if (debounced.length > 0) {
      const prev = debounced[debounced.length - 1];
      const diffSec = (current.timeUtc.getTime() - prev.timeUtc.getTime()) / 1000;
      if (diffSec < 45) {
        // Skip rapid accidental re-scan
        continue;
      }
    }
    debounced.push(current);
  }

  // 3. Build Intervals
  const intervals: ReconciledInterval[] = [];
  let inCount = 0;
  let outCount = 0;
  let completedBreakCount = 0;

  let firstInTime: Date | null = null;
  let lastInTime: Date | null = null;
  let lastOutTime: Date | null = null;

  // First punch is always First IN
  firstInTime = debounced[0].timeUtc;
  lastInTime = firstInTime;
  inCount = 1;

  let currentType: 'WORK' | 'BREAK' = 'WORK';
  let activeIntervalStart: Date = firstInTime;
  let activeStartEventId: bigint = debounced[0].id;

  for (let i = 1; i < debounced.length; i++) {
    const punch = debounced[i];
    const punchTime = punch.timeUtc;

    if (currentType === 'WORK') {
      // Transition from WORK -> BREAK (Employee punched OUT)
      const durationSec = Math.max(0, Math.floor((punchTime.getTime() - activeIntervalStart.getTime()) / 1000));
      intervals.push({
        type: 'WORK',
        startTime: activeIntervalStart,
        endTime: punchTime,
        durationSeconds: durationSec,
        startEventId: activeStartEventId,
        endEventId: punch.id,
        isCompleted: true,
      });

      lastOutTime = punchTime;
      outCount++;

      // Next open interval is BREAK
      currentType = 'BREAK';
      activeIntervalStart = punchTime;
      activeStartEventId = punch.id;
    } else {
      // Transition from BREAK -> WORK (Employee punched back IN)
      const durationSec = Math.max(0, Math.floor((punchTime.getTime() - activeIntervalStart.getTime()) / 1000));
      intervals.push({
        type: 'BREAK',
        startTime: activeIntervalStart,
        endTime: punchTime,
        durationSeconds: durationSec,
        startEventId: activeStartEventId,
        endEventId: punch.id,
        isCompleted: true,
      });

      completedBreakCount++;
      lastInTime = punchTime;
      inCount++;

      // Next open interval is WORK
      currentType = 'WORK';
      activeIntervalStart = punchTime;
      activeStartEventId = punch.id;
    }
  }

  // The latest punch represents the active open interval
  intervals.push({
    type: currentType,
    startTime: activeIntervalStart,
    endTime: null,
    durationSeconds: 0,
    startEventId: activeStartEventId,
    endEventId: null,
    isCompleted: false,
  });

  // Calculate cumulative completed durations
  const totalWorkingSeconds = intervals
    .filter((inv) => inv.type === 'WORK' && inv.isCompleted)
    .reduce((sum, inv) => sum + inv.durationSeconds, 0);

  const totalBreakSeconds = intervals
    .filter((inv) => inv.type === 'BREAK' && inv.isCompleted)
    .reduce((sum, inv) => sum + inv.durationSeconds, 0);

  // Determine Session State & Completion
  let currentState: ReconciledSessionMetrics['currentState'] = currentType === 'WORK' ? 'WORKING' : 'ON_BREAK';
  let completionStatus: ReconciledSessionMetrics['completionStatus'] = 'ACTIVE';
  let totalElapsedSeconds = 0;

  // Closure rules based on time elapsed and shift window
  const nowMs = nowUtc.getTime();
  const firstInMs = firstInTime ? firstInTime.getTime() : 0;
  const hoursSinceFirstIn = firstInMs > 0 ? (nowMs - firstInMs) / (1000 * 60 * 60) : 0;
  const lastOutMs = lastOutTime ? lastOutTime.getTime() : 0;
  const hoursSinceLastOut = lastOutMs > 0 ? (nowMs - lastOutMs) / (1000 * 60 * 60) : 0;

  // Max shift duration threshold for auto-closure or flagging (shift duration + 5 hours grace)
  const maxShiftHours = (shift.durationMinutes / 60) + 5; // e.g. 9 + 5 = 14 hours

  if (currentType === 'BREAK') {
    // Employee punched OUT. Is this a temporary break or final shift exit?
    // If it's been more than 4 hours since last OUT, or total time since first IN exceeds maxShiftHours
    if (hoursSinceLastOut >= 4 || hoursSinceFirstIn >= maxShiftHours) {
      currentState = 'COMPLETED';
      completionStatus = 'COMPLETED';
      // Shift is completed at lastOutTime. Total elapsed is lastOutTime - firstInTime
      totalElapsedSeconds = Math.max(0, Math.floor((lastOutMs - firstInMs) / 1000));

      // Remove the trailing unclosed BREAK interval since it is actually the final departure, not an ongoing break
      if (intervals.length > 0 && !intervals[intervals.length - 1].isCompleted) {
        intervals.pop();
      }
    } else {
      // Actively on break
      currentState = 'ON_BREAK';
      completionStatus = 'ACTIVE';
      totalElapsedSeconds = Math.max(0, Math.floor((nowMs - firstInMs) / 1000));
    }
  } else {
    // Current state is WORK
    // If more than maxShiftHours have passed since First IN and employee never clocked OUT:
    if (hoursSinceFirstIn >= maxShiftHours) {
      currentState = 'MISSING_OUT';
      completionStatus = 'PENDING_CLOSURE';
      // Freeze elapsed at max shift duration or up to cutoff for fairness pending HR review
      totalElapsedSeconds = Math.max(0, Math.floor((nowMs - firstInMs) / 1000));
      // Mark active interval as incomplete
    } else {
      currentState = 'WORKING';
      completionStatus = 'ACTIVE';
      totalElapsedSeconds = Math.max(0, Math.floor((nowMs - firstInMs) / 1000));
    }
  }

  return {
    firstInTime,
    lastInTime,
    lastOutTime,
    currentState,
    completionStatus,
    currentIntervalStart: activeIntervalStart,
    inCount,
    outCount,
    completedBreakCount,
    totalWorkingSeconds,
    totalBreakSeconds,
    totalElapsedSeconds,
    intervals,
  };
}

/**
 * Persists calculated session intervals and metrics to MySQL in an atomic transaction
 */
export async function persistReconciledSession(
  employeeId: bigint | string | number,
  businessDate: Date | string,
  shift: ShiftInfo,
  metrics: ReconciledSessionMetrics
) {
  const empIdStr = employeeId.toString();
  const bDateStr =
    businessDate instanceof Date
      ? businessDate.toISOString().split('T')[0]
      : String(businessDate).split('T')[0];

  return await withTransaction(async (conn) => {
    // 1. Upsert attendance_sessions
    const upsertSql = `
      INSERT INTO attendance_sessions (
        employee_id, shift_id, business_date, first_in_time, last_in_time, last_out_time,
        current_interval_start, in_count, out_count, completed_break_count,
        total_working_seconds, total_break_seconds, total_elapsed_seconds, total_work_minutes,
        status, completion_status, is_overnight, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, NOW(), NOW()
      )
      ON DUPLICATE KEY UPDATE
        shift_id = VALUES(shift_id),
        first_in_time = VALUES(first_in_time),
        last_in_time = VALUES(last_in_time),
        last_out_time = VALUES(last_out_time),
        current_interval_start = VALUES(current_interval_start),
        in_count = VALUES(in_count),
        out_count = VALUES(out_count),
        completed_break_count = VALUES(completed_break_count),
        total_working_seconds = VALUES(total_working_seconds),
        total_break_seconds = VALUES(total_break_seconds),
        total_elapsed_seconds = VALUES(total_elapsed_seconds),
        total_work_minutes = VALUES(total_work_minutes),
        status = VALUES(status),
        completion_status = VALUES(completion_status),
        is_overnight = VALUES(is_overnight),
        updated_at = NOW()
    `;

    const totalWorkMinutes = Math.floor(metrics.totalWorkingSeconds / 60);
    const isOvernight = shift.isOvernight ? 1 : 0;
    const shiftIdVal = shift.id ? shift.id.toString() : null;

    await conn.execute(upsertSql, [
      empIdStr,
      shiftIdVal,
      bDateStr,
      metrics.firstInTime,
      metrics.lastInTime,
      metrics.lastOutTime,
      metrics.currentIntervalStart,
      metrics.inCount,
      metrics.outCount,
      metrics.completedBreakCount,
      metrics.totalWorkingSeconds,
      metrics.totalBreakSeconds,
      metrics.totalElapsedSeconds,
      totalWorkMinutes,
      metrics.currentState,
      metrics.completionStatus,
      isOvernight,
    ]);

    // Fetch the updated session record
    const [sessionRows]: any = await conn.execute(
      `SELECT * FROM attendance_sessions WHERE employee_id = ? AND business_date = ? LIMIT 1`,
      [empIdStr, bDateStr]
    );

    if (!sessionRows || sessionRows.length === 0) {
      throw new Error(
        `Failed to find attendance session after upsert for employee ${empIdStr} on ${bDateStr}`
      );
    }

    const session = sessionRows[0];
    const sessionId = session.id.toString();

    // 2. Re-create intervals cleanly for this session
    await conn.execute(`DELETE FROM attendance_intervals WHERE session_id = ?`, [sessionId]);

    for (const inv of metrics.intervals) {
      const invStatus = inv.isCompleted ? 'COMPLETED' : 'ACTIVE';
      const startEventId = inv.startEventId ? inv.startEventId.toString() : null;
      const endEventId = inv.endEventId ? inv.endEventId.toString() : null;

      await conn.execute(
        `INSERT INTO attendance_intervals (
          session_id, employee_id, interval_type, start_time, end_time,
          duration_seconds, start_event_id, end_event_id, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          sessionId,
          empIdStr,
          inv.type,
          inv.startTime,
          inv.endTime,
          inv.durationSeconds,
          startEventId,
          endEventId,
          invStatus,
        ]
      );
    }

    return session;
  });
}
