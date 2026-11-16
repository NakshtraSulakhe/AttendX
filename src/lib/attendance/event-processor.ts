import { query, queryOne, execute } from '../db';
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
  const affectedEmployeeShifts: Map<
    string,
    { employeeId: string; businessDateStr: string; shift: ShiftInfo }
  > = new Map();

  for (const raw of events) {
    if (!raw.employeeNoString) {
      continue;
    }

    const eventTimeUtc = new Date(raw.time);
    if (isNaN(eventTimeUtc.getTime())) {
      console.warn(`[Processor] Invalid event time: ${raw.time}`);
      continue;
    }

    // 1. Find employee by biometricNumber with joined shift
    let employee = await queryOne<any>(
      `SELECT e.id, e.employee_code, e.name, e.biometric_number, e.shift_id,
              s.name AS shift_name, s.code AS shift_code, s.is_overnight,
              s.shift_start_local, s.shift_end_local, s.timezone AS shift_timezone,
              s.duration_minutes, s.grace_late_minutes, s.grace_early_exit_minutes,
              s.overtime_min_minutes
       FROM employees e
       LEFT JOIN shift_configurations s ON e.shift_id = s.id
       WHERE e.biometric_number = ?
       LIMIT 1`,
      [raw.employeeNoString]
    );

    // Auto-enroll employee if not already in system
    if (!employee) {
      const defaultShift = await queryOne<any>(
        `SELECT id, name, code, is_overnight, shift_start_local, shift_end_local,
                timezone, duration_minutes, grace_late_minutes, grace_early_exit_minutes,
                overtime_min_minutes
         FROM shift_configurations
         WHERE is_default = 1
         LIMIT 1`
      );

      const empName = (raw.name || `Employee #${raw.employeeNoString}`).trim();
      const candidateCode = `EMP${raw.employeeNoString.padStart(4, '0')}`;

      const existingWithCode = await queryOne<any>(
        `SELECT id FROM employees WHERE employee_code = ? LIMIT 1`,
        [candidateCode]
      );
      const finalCode = existingWithCode ? `BIO_${raw.employeeNoString}` : candidateCode;

      try {
        const insertRes = await execute(
          `INSERT INTO employees (
            employee_code, name, biometric_number, designation, status,
            shift_id, date_of_joining, created_at, updated_at
          ) VALUES (?, ?, ?, 'Operations Staff', 'ACTIVE', ?, '2024-01-01', NOW(), NOW())`,
          [finalCode, empName, raw.employeeNoString, defaultShift ? defaultShift.id.toString() : null]
        );

        employee = {
          id: insertRes.insertId.toString(),
          employee_code: finalCode,
          name: empName,
          biometric_number: raw.employeeNoString,
          shift_id: defaultShift?.id,
          shift_name: defaultShift?.name,
          shift_code: defaultShift?.code,
          is_overnight: defaultShift?.is_overnight,
          shift_start_local: defaultShift?.shift_start_local,
          shift_end_local: defaultShift?.shift_end_local,
          shift_timezone: defaultShift?.timezone,
          duration_minutes: defaultShift?.duration_minutes,
          grace_late_minutes: defaultShift?.grace_late_minutes,
          grace_early_exit_minutes: defaultShift?.grace_early_exit_minutes,
          overtime_min_minutes: defaultShift?.overtime_min_minutes,
        };
      } catch {
        employee = await queryOne<any>(
          `SELECT e.id, e.employee_code, e.name, e.biometric_number, e.shift_id,
                  s.name AS shift_name, s.code AS shift_code, s.is_overnight,
                  s.shift_start_local, s.shift_end_local, s.timezone AS shift_timezone,
                  s.duration_minutes, s.grace_late_minutes, s.grace_early_exit_minutes,
                  s.overtime_min_minutes
           FROM employees e
           LEFT JOIN shift_configurations s ON e.shift_id = s.id
           WHERE e.biometric_number = ?
           LIMIT 1`,
          [raw.employeeNoString]
        );
      }
    }

    // Determine shift
    let shift: ShiftInfo = DEFAULT_OVERNIGHT_SHIFT;
    if (employee && employee.shift_id) {
      shift = {
        id: employee.shift_id,
        name: employee.shift_name || DEFAULT_OVERNIGHT_SHIFT.name,
        code: employee.shift_code || DEFAULT_OVERNIGHT_SHIFT.code,
        isOvernight: employee.is_overnight === 1 || employee.is_overnight === true,
        startTimeLocal: employee.shift_start_local || '17:30:00',
        endTimeLocal: employee.shift_end_local || '02:30:00',
        timezone: employee.shift_timezone || 'Asia/Kolkata',
        durationMinutes: employee.duration_minutes ?? 540,
        graceLateMinutes: employee.grace_late_minutes ?? 15,
        graceEarlyExitMinutes: employee.grace_early_exit_minutes ?? 15,
        overtimeMinMinutes: employee.overtime_min_minutes ?? 30,
      };
    }

    // 2. Insert raw event with deduplication
    try {
      const rawPayloadJson = raw.rawPayload ? JSON.stringify(raw.rawPayload) : null;
      const attStatus = raw.attendanceStatus ? String(raw.attendanceStatus) : null;

      await execute(
        `INSERT INTO biometric_raw_events (
          serial_no, event_time_utc, event_time_device, employee_no_string, employee_id,
          card_no, verify_mode, major_code, minor_code, attendance_status, raw_payload,
          ingestion_source, is_processed, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
        [
          raw.serialNo,
          eventTimeUtc,
          raw.time,
          raw.employeeNoString,
          employee ? employee.id.toString() : null,
          raw.cardNo || null,
          raw.currentVerifyMode || 'face',
          raw.major ?? 5,
          raw.minor ?? 75,
          attStatus,
          rawPayloadJson,
          source,
        ]
      );
      insertedCount++;

      if (employee) {
        const businessDateStr = getBusinessDateString(eventTimeUtc, shift);
        const empIdStr = employee.id.toString();
        const key = `${empIdStr}_${businessDateStr}`;
        affectedEmployeeShifts.set(key, { employeeId: empIdStr, businessDateStr, shift });
      }

      // Broadcast raw punch to SSE clients
      sseBroadcaster.broadcast('new_punch', {
        employeeName: employee?.name || raw.name || `ID: ${raw.employeeNoString}`,
        employeeCode: employee?.employee_code || raw.employeeNoString,
        biometricNumber: raw.employeeNoString,
        time: raw.time,
        verifyMode: raw.currentVerifyMode || 'face',
        source,
      });
    } catch (err: any) {
      if (err.code === 'ER_DUP_ENTRY' || err.code === 'P2002') {
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
  employeeId: bigint | string | number,
  businessDateStr: string,
  shift: ShiftInfo
) {
  const empIdStr = employeeId.toString();
  const businessDate = new Date(`${businessDateStr}T00:00:00Z`);
  const { windowStart, windowEnd } = getShiftWindowUtc(businessDateStr, shift);

  const rawEvents = await query<any>(
    `SELECT id, serial_no, event_time_utc, event_time_device, verify_mode, attendance_status, minor_code
     FROM biometric_raw_events
     WHERE employee_id = ? AND event_time_utc >= ? AND event_time_utc <= ?
     ORDER BY event_time_utc ASC`,
    [empIdStr, windowStart, windowEnd]
  );

  const punches: PunchRecord[] = rawEvents.map((r) => ({
    id: BigInt(r.id),
    serialNo: r.serial_no,
    timeUtc: new Date(r.event_time_utc),
    timeDevice: r.event_time_device,
    verifyMode: r.verify_mode,
    attendanceStatus: r.attendance_status,
    minor: r.minor_code || undefined,
  }));

  const metrics = reconcilePunchesToIntervals(punches, shift);
  const session = await persistReconciledSession(empIdStr, businessDate, shift, metrics);

  // Broadcast session change to dashboard
  sseBroadcaster.broadcast('attendance_updated', {
    employeeId: empIdStr,
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
