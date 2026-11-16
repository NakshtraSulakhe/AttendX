import { prisma } from '../prisma';
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
 * Persists calculated session intervals and metrics to MySQL in a transaction
 */
export async function persistReconciledSession(
  employeeId: bigint,
  businessDate: Date,
  shift: ShiftInfo,
  metrics: ReconciledSessionMetrics
) {
  return await prisma.$transaction(async (tx) => {
    // 1. Upsert AttendanceSession
    const session = await tx.attendanceSession.upsert({
      where: {
        employeeId_businessDate: {
          employeeId,
          businessDate,
        },
      },
      update: {
        shiftId: shift.id,
        firstInTime: metrics.firstInTime,
        lastInTime: metrics.lastInTime,
        lastOutTime: metrics.lastOutTime,
        currentIntervalStart: metrics.currentIntervalStart,
        inCount: metrics.inCount,
        outCount: metrics.outCount,
        completedBreakCount: metrics.completedBreakCount,
        totalWorkingSeconds: metrics.totalWorkingSeconds,
        totalBreakSeconds: metrics.totalBreakSeconds,
        totalElapsedSeconds: metrics.totalElapsedSeconds,
        totalWorkMinutes: Math.floor(metrics.totalWorkingSeconds / 60),
        status: metrics.currentState as any,
        completionStatus: metrics.completionStatus,
        updatedAt: new Date(),
      },
      create: {
        employeeId,
        shiftId: shift.id,
        businessDate,
        firstInTime: metrics.firstInTime,
        lastInTime: metrics.lastInTime,
        lastOutTime: metrics.lastOutTime,
        currentIntervalStart: metrics.currentIntervalStart,
        inCount: metrics.inCount,
        outCount: metrics.outCount,
        completedBreakCount: metrics.completedBreakCount,
        totalWorkingSeconds: metrics.totalWorkingSeconds,
        totalBreakSeconds: metrics.totalBreakSeconds,
        totalElapsedSeconds: metrics.totalElapsedSeconds,
        totalWorkMinutes: Math.floor(metrics.totalWorkingSeconds / 60),
        status: metrics.currentState as any,
        completionStatus: metrics.completionStatus,
      },
    });

    // 2. Re-create intervals cleanly for this session
    await tx.attendanceInterval.deleteMany({
      where: { sessionId: session.id },
    });

    for (const inv of metrics.intervals) {
      await tx.attendanceInterval.create({
        data: {
          sessionId: session.id,
          employeeId,
          intervalType: inv.type,
          startTime: inv.startTime,
          endTime: inv.endTime,
          durationSeconds: inv.durationSeconds,
          startEventId: inv.startEventId,
          endEventId: inv.endEventId,
          status: inv.isCompleted ? 'COMPLETED' : 'ACTIVE',
        },
      });
    }

    return session;
  }, {
    maxWait: 10000,
    timeout: 30000,
  });
}
