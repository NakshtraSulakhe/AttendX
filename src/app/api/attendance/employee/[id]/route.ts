import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import {
  DEFAULT_OVERNIGHT_SHIFT,
  ShiftInfo,
  getBusinessDateString,
  getShiftWindowUtc,
} from '@/lib/attendance/shift-calculator';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employeeId = params.id;
    const { searchParams } = new URL(req.url);

    const now = new Date();
    const defaultBusinessDateStr = getBusinessDateString(now, DEFAULT_OVERNIGHT_SHIFT);
    const businessDateStr = searchParams.get('date') || defaultBusinessDateStr;

    // 1. Fetch employee
    const employee = await queryOne<any>(
      `SELECT e.*,
              d.name AS department_name,
              s.id AS shift_config_id, s.name AS shift_name, s.code AS shift_code,
              s.is_overnight, s.shift_start_local, s.shift_end_local,
              s.timezone AS shift_timezone, s.duration_minutes,
              s.grace_late_minutes, s.grace_early_exit_minutes, s.overtime_min_minutes
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN shift_configurations s ON e.shift_id = s.id
       WHERE e.id = ?
       LIMIT 1`,
      [employeeId]
    );

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // 2. Fetch session for this business date
    const session = await queryOne<any>(
      `SELECT * FROM attendance_sessions WHERE employee_id = ? AND business_date = ? LIMIT 1`,
      [employeeId, businessDateStr]
    );

    // Fetch intervals if session exists
    let intervals: any[] = [];
    if (session) {
      intervals = await query<any>(
        `SELECT * FROM attendance_intervals WHERE session_id = ? ORDER BY start_time ASC`,
        [session.id]
      );
    }

    // 3. Determine Shift Window
    let shift: ShiftInfo = DEFAULT_OVERNIGHT_SHIFT;
    if (employee.shift_config_id) {
      shift = {
        id: employee.shift_config_id,
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

    const { windowStart, windowEnd } = getShiftWindowUtc(businessDateStr, shift);

    const rawPunches = await query<any>(
      `SELECT r.*, d.name AS device_name
       FROM biometric_raw_events r
       LEFT JOIN biometric_devices d ON r.device_id = d.id
       WHERE r.employee_id = ? AND r.event_time_utc >= ? AND r.event_time_utc <= ?
       ORDER BY r.event_time_utc ASC`,
      [employeeId, windowStart, windowEnd]
    );

    // Map punches with calculated interval context
    const punchHistory = rawPunches.map((p, index) => {
      const pIdStr = p.id.toString();
      const matchedInterval = intervals.find(
        (inv) =>
          (inv.start_event_id && inv.start_event_id.toString() === pIdStr) ||
          (inv.end_event_id && inv.end_event_id.toString() === pIdStr)
      );

      const isStart = matchedInterval && matchedInterval.start_event_id?.toString() === pIdStr;
      let punchType = 'PUNCH';
      if (matchedInterval) {
        if (matchedInterval.interval_type === 'WORK') {
          punchType = isStart ? 'IN' : 'OUT';
        } else if (matchedInterval.interval_type === 'BREAK') {
          punchType = isStart ? 'OUT' : 'IN';
        }
      }

      const eventDate = new Date(p.event_time_utc);

      return {
        sequence: index + 1,
        id: pIdStr,
        serialNo: p.serial_no,
        timestampUtc: eventDate.toISOString(),
        timestampDevice: p.event_time_device,
        timeIst: eventDate.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
        timeEst: eventDate.toLocaleTimeString('en-US', { timeZone: 'America/New_York' }),
        punchType,
        verifyMode: p.verify_mode || 'face',
        deviceName: p.device_name || 'Hikvision Terminal',
        source: p.ingestion_source,
        intervalType: matchedInterval?.interval_type || 'WORK',
      };
    });

    return NextResponse.json({
      success: true,
      serverTimeUtc: now.toISOString(),
      employee: {
        id: employee.id.toString(),
        code: employee.employee_code,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        department: employee.department_name || 'General Operations',
        designation: employee.designation || 'Staff',
        biometricNumber: employee.biometric_number,
        shiftName: employee.shift_name || 'US Operations Overnight',
        shiftHours: `${employee.shift_start_local || '17:30'} - ${employee.shift_end_local || '02:30'} IST`,
      },
      session: session
        ? {
            id: session.id.toString(),
            businessDate: businessDateStr,
            currentState: session.status,
            completionStatus: session.completion_status,
            firstInTime: session.first_in_time ? new Date(session.first_in_time).toISOString() : null,
            lastInTime: session.last_in_time ? new Date(session.last_in_time).toISOString() : null,
            lastOutTime: session.last_out_time ? new Date(session.last_out_time).toISOString() : null,
            currentIntervalStart: session.current_interval_start
              ? new Date(session.current_interval_start).toISOString()
              : null,
            inCount: session.in_count || 0,
            outCount: session.out_count || 0,
            completedBreakCount: session.completed_break_count || 0,
            totalWorkingSeconds: session.total_working_seconds || 0,
            totalBreakSeconds: session.total_break_seconds || 0,
            totalElapsedSeconds: session.total_elapsed_seconds || 0,
          }
        : null,
      intervals: intervals.map((inv, idx) => ({
        id: inv.id.toString(),
        sequence: idx + 1,
        type: inv.interval_type,
        startTime: new Date(inv.start_time).toISOString(),
        endTime: inv.end_time ? new Date(inv.end_time).toISOString() : null,
        durationSeconds: inv.duration_seconds || 0,
        status: inv.status,
      })),
      punchHistory,
    });
  } catch (error: any) {
    console.error('[API /api/attendance/employee/[id] Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
