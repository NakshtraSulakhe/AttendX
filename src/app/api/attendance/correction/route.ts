import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db';
import { recalculateEmployeeSession } from '@/lib/attendance/event-processor';
import { DEFAULT_OVERNIGHT_SHIFT, ShiftInfo } from '@/lib/attendance/shift-calculator';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      employeeId,
      businessDate,
      action, // 'RESOLVE_MISSING_OUT' | 'MANUAL_IN' | 'MANUAL_OUT' | 'ADJUST_TIMES'
      punchTimeUtc,
      reason,
      requestedBy = 'HR Administrator',
    } = body;

    if (!employeeId || !businessDate || !reason) {
      return NextResponse.json(
        { error: 'employeeId, businessDate, and reason are required' },
        { status: 400 }
      );
    }

    const empIdStr = employeeId.toString();
    const bDateStr = String(businessDate).split('T')[0];

    const employee = await queryOne<any>(
      `SELECT e.*,
              s.id AS shift_config_id, s.name AS shift_name, s.code AS shift_code,
              s.is_overnight, s.shift_start_local, s.shift_end_local,
              s.timezone AS shift_timezone, s.duration_minutes,
              s.grace_late_minutes, s.grace_early_exit_minutes, s.overtime_min_minutes
       FROM employees e
       LEFT JOIN shift_configurations s ON e.shift_id = s.id
       WHERE e.id = ?
       LIMIT 1`,
      [empIdStr]
    );

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const session = await queryOne<any>(
      `SELECT * FROM attendance_sessions WHERE employee_id = ? AND business_date = ? LIMIT 1`,
      [empIdStr, bDateStr]
    );

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

    const correctionTime = punchTimeUtc ? new Date(punchTimeUtc) : new Date();

    const prevIn = session?.first_in_time ? new Date(session.first_in_time) : null;
    const prevOut = session?.last_out_time ? new Date(session.last_out_time) : null;
    const newIn = action === 'MANUAL_IN' ? correctionTime : prevIn;
    const newOut =
      action === 'RESOLVE_MISSING_OUT' || action === 'MANUAL_OUT'
        ? correctionTime
        : prevOut;

    // Log the correction audit entry
    await execute(
      `INSERT INTO attendance_corrections (
        session_id, employee_id, business_date, previous_in_time, new_in_time,
        previous_out_time, new_out_time, reason, requested_by, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'APPROVED', NOW())`,
      [
        session?.id ? session.id.toString() : '0',
        empIdStr,
        bDateStr,
        prevIn,
        newIn,
        prevOut,
        newOut,
        `[${action}] ${reason} (by ${requestedBy})`,
      ]
    );

    // If adding a manual punch, insert into BiometricRawEvent as an authorized manual event
    if (action === 'MANUAL_IN' || action === 'MANUAL_OUT' || action === 'RESOLVE_MISSING_OUT') {
      const serialNo = Math.floor(Date.now() % 1000000);
      const isOut = action === 'MANUAL_OUT' || action === 'RESOLVE_MISSING_OUT';
      const rawPayload = JSON.stringify({
        reason,
        action,
        correctedBy: requestedBy,
      });

      await execute(
        `INSERT INTO biometric_raw_events (
          serial_no, event_time_utc, event_time_device, employee_no_string, employee_id,
          verify_mode, attendance_status, ingestion_source, is_processed, raw_payload, created_at
        ) VALUES (?, ?, ?, ?, ?, 'manual_hr_correction', ?, 'manual_correction', 1, ?, NOW())`,
        [
          serialNo,
          correctionTime,
          correctionTime.toISOString().replace('T', ' ').slice(0, 19),
          employee.biometric_number,
          empIdStr,
          isOut ? 'checkOut' : 'checkIn',
          rawPayload,
        ]
      );

      // Recalculate session and intervals
      const updatedSession = await recalculateEmployeeSession(
        empIdStr,
        bDateStr,
        shift
      );

      // Mark session as manually corrected
      await execute(
        `UPDATE attendance_sessions
         SET is_manual_correction = 1, notes = ?
         WHERE id = ?`,
        [`Manually corrected: ${reason}`, updatedSession.id.toString()]
      );

      return NextResponse.json({
        success: true,
        message: 'Attendance corrected and reconciled successfully',
        session: {
          id: updatedSession.id.toString(),
          status: updatedSession.status,
          totalWorkingSeconds: updatedSession.total_working_seconds || updatedSession.totalWorkingSeconds,
          totalBreakSeconds: updatedSession.total_break_seconds || updatedSession.totalBreakSeconds,
          inCount: updatedSession.in_count || updatedSession.inCount,
          outCount: updatedSession.out_count || updatedSession.outCount,
        },
      });
    }

    return NextResponse.json({ success: true, message: 'Correction noted' });
  } catch (error: any) {
    console.error('[AttendanceCorrection] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
