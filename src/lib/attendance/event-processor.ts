import { prisma } from '../prisma';
import { sseBroadcaster } from '../realtime/sse-broadcaster';
import {
  DEFAULT_OVERNIGHT_SHIFT,
  ShiftInfo,
  getBusinessDateString,
  getShiftWindowUtc,
} from './shift-calculator';
import {
  reconcilePunchesToIntervals,
  persistReconciledSession,
  PunchRecord,
} from './interval-engine';

export interface IngestedEvent {
  serialNo: number;
  time: string; // ISO string
  employeeNoString?: string;
  name?: string;
  cardNo?: string;
  currentVerifyMode?: string;
  attendanceStatus?: string | number;
  major?: number;
  minor?: number;
  rawPayload?: any;
}

export interface IngestionResult {
  insertedCount: number;
  duplicateCount: number;
  recalculatedSessions: number;
}

export async function processIngestedEvents(
  events: IngestedEvent[],
  source: 'stream' | 'poll' = 'stream'
): Promise<IngestionResult> {
  if (!events || events.length === 0) {
    return { insertedCount: 0, duplicateCount: 0, recalculatedSessions: 0 };
  }

  let insertedCount = 0;
  let duplicateCount = 0;
  const affectedEmployeeShifts: Map<string, { employeeId: bigint; businessDateStr: string; shift: ShiftInfo }> = new Map();

  for (const raw of events) {
    if (!raw.employeeNoString) {
      continue;
    }

    const eventTimeUtc = new Date(raw.time);
    if (isNaN(eventTimeUtc.getTime())) {
      console.warn(`[Processor] Invalid event time: ${raw.time}`);
      continue;
    }

    // 1. Find employee by biometricNumber
    let employee = await prisma.employee.findUnique({
      where: { biometricNumber: raw.employeeNoString },
      include: { shift: true },
    });

    // Auto-enroll employee if not already in system
    if (!employee) {
      const defaultShift = await prisma.shiftConfiguration.findFirst({ where: { isDefault: true } });
      const empName = raw.name || `Employee #${raw.employeeNoString}`;
      try {
        const candidateCode = `EMP${raw.employeeNoString.padStart(4, '0')}`;
        const existingWithCode = await prisma.employee.findUnique({ where: { employeeCode: candidateCode } });
        const finalCode = existingWithCode ? `BIO_${raw.employeeNoString}` : candidateCode;

        employee = await prisma.employee.create({
          data: {
            employeeCode: finalCode,
            name: empName.trim(),
            biometricNumber: raw.employeeNoString,
            designation: 'Operations Staff',
            status: 'ACTIVE',
            shiftId: defaultShift?.id,
            dateOfJoining: new Date('2024-01-01'),
          },
          include: { shift: true },
        });
      } catch {
        employee = await prisma.employee.findUnique({
          where: { biometricNumber: raw.employeeNoString },
          include: { shift: true },
        });
      }
    }

    // Determine shift
    let shift: ShiftInfo = DEFAULT_OVERNIGHT_SHIFT;
    if (employee?.shift) {
      shift = {
        id: employee.shift.id,
        name: employee.shift.name,
        code: employee.shift.code,
        isOvernight: employee.shift.isOvernight,
        startTimeLocal: employee.shift.startTimeLocal,
        endTimeLocal: employee.shift.endTimeLocal,
        timezone: employee.shift.timezone,
        durationMinutes: employee.shift.durationMinutes,
        graceLateMinutes: employee.shift.graceLateMinutes,
        graceEarlyExitMinutes: employee.shift.graceEarlyExitMinutes,
        overtimeMinMinutes: employee.shift.overtimeMinMinutes,
      };
    }

    // 2. Insert raw event with deduplication
    try {
      await prisma.biometricRawEvent.create({
        data: {
          serialNo: raw.serialNo,
          eventTimeUtc: eventTimeUtc,
          eventTimeDevice: raw.time,
          employeeNoString: raw.employeeNoString,
          employeeId: employee?.id,
          cardNo: raw.cardNo,
          verifyMode: raw.currentVerifyMode || 'face',
          majorCode: raw.major ?? 5,
          minorCode: raw.minor ?? 75,
          attendanceStatus: raw.attendanceStatus ? String(raw.attendanceStatus) : undefined,
          rawPayload: raw.rawPayload,
          ingestionSource: source,
          isProcessed: true,
        },
      });
      insertedCount++;

      if (employee) {
        const businessDateStr = getBusinessDateString(eventTimeUtc, shift);
        const key = `${employee.id}_${businessDateStr}`;
        affectedEmployeeShifts.set(key, { employeeId: employee.id, businessDateStr, shift });
      }

      // Broadcast raw punch to SSE clients
      sseBroadcaster.broadcast('new_punch', {
        employeeName: employee?.name || raw.name || `ID: ${raw.employeeNoString}`,
        employeeCode: employee?.employeeCode || raw.employeeNoString,
        biometricNumber: raw.employeeNoString,
        time: raw.time,
        verifyMode: raw.currentVerifyMode || 'face',
        source,
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        duplicateCount++;
      } else {
        console.error('[Processor] Error inserting raw event:', err.message);
      }
    }
  }

  // 3. Recalculate sessions and intervals for all affected employees
  let recalculatedSessions = 0;
  for (const [, { employeeId, businessDateStr, shift }] of affectedEmployeeShifts.entries()) {
    try {
      await recalculateEmployeeSession(employeeId, businessDateStr, shift);
      recalculatedSessions++;
    } catch (err: any) {
      console.error(`[Processor] Error recalculating session for emp ${employeeId}:`, err.message);
    }
  }

  return { insertedCount, duplicateCount, recalculatedSessions };
}

/**
 * Re-queries all raw events for an employee on a business date and recalculates WORK/BREAK intervals
 */
export async function recalculateEmployeeSession(
  employeeId: bigint,
  businessDateStr: string,
  shift: ShiftInfo
) {
  const businessDate = new Date(`${businessDateStr}T00:00:00Z`);

  const { windowStart, windowEnd } = getShiftWindowUtc(businessDateStr, shift);

  const rawEvents = await prisma.biometricRawEvent.findMany({
    where: {
      employeeId,
      eventTimeUtc: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    orderBy: { eventTimeUtc: 'asc' },
  });

  const punches: PunchRecord[] = rawEvents.map((r) => ({
    id: r.id,
    serialNo: r.serialNo,
    timeUtc: r.eventTimeUtc,
    timeDevice: r.eventTimeDevice,
    verifyMode: r.verifyMode,
    attendanceStatus: r.attendanceStatus,
    minor: r.minorCode || undefined,
  }));

  const metrics = reconcilePunchesToIntervals(punches, shift);
  const session = await persistReconciledSession(employeeId, businessDate, shift, metrics);

  // Broadcast session change to dashboard
  sseBroadcaster.broadcast('attendance_updated', {
    employeeId: employeeId.toString(),
    businessDate: businessDateStr,
    currentState: metrics.currentState,
    firstInTime: metrics.firstInTime?.toISOString(),
    lastInTime: metrics.lastInTime?.toISOString(),
    lastOutTime: metrics.lastOutTime?.toISOString(),
    currentIntervalStart: metrics.currentIntervalStart?.toISOString(),
    inCount: metrics.inCount,
    outCount: metrics.outCount,
    completedBreakCount: metrics.completedBreakCount,
    totalWorkingSeconds: metrics.totalWorkingSeconds,
    totalBreakSeconds: metrics.totalBreakSeconds,
  });

  return session;
}
