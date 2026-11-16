import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { fromZonedTime } from 'date-fns-tz';
import {
  DEFAULT_OVERNIGHT_SHIFT,
  getBusinessDateString,
  getShiftWindowUtc,
} from '@/lib/attendance/shift-calculator';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = new Date();
    const currentBusinessDateStr = getBusinessDateString(now, DEFAULT_OVERNIGHT_SHIFT);
    const businessDate = `${currentBusinessDateStr}`;

    // 1. All Active Employees with Department & Shift
    const allEmployees = await query<any>(
      `SELECT e.id, e.employee_code, e.name, e.biometric_number, e.designation,
              d.name AS department_name, s.name AS shift_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN shift_configurations s ON e.shift_id = s.id
       WHERE e.status = 'ACTIVE'
       ORDER BY e.name ASC`
    );

    // 2. Attendance Sessions for current business date
    const todaySessions = await query<any>(
      `SELECT s.*
       FROM attendance_sessions s
       WHERE s.business_date = ?`,
      [businessDate]
    );

    const sessionByEmpId = new Map<string, any>();
    for (const s of todaySessions) {
      sessionByEmpId.set(s.employee_id.toString(), s);
    }

    // 3. Today's Raw Punches (Covers the full 24h clock: from 00:00:00 IST of business date through the overnight shift window end)
    const dayStartUtc = fromZonedTime(`${currentBusinessDateStr} 00:00:00`, 'Asia/Kolkata');
    const { windowEnd } = getShiftWindowUtc(currentBusinessDateStr, DEFAULT_OVERNIGHT_SHIFT);

    const recentPunches = await query<any>(
      `SELECT r.id, r.serial_no, r.event_time_utc, r.event_time_device, r.employee_no_string,
              r.verify_mode, r.attendance_status, r.ingestion_source,
              e.name AS employee_name, e.employee_code, d.name AS department_name,
              CASE WHEN e.id IS NOT NULL THEN 1 ELSE 0 END AS is_confirmed
       FROM biometric_raw_events r
       LEFT JOIN employees e ON r.employee_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE r.event_time_utc >= ? AND r.event_time_utc <= ?
       ORDER BY r.event_time_utc DESC
       LIMIT 500`,
      [dayStartUtc, windowEnd]
    );

    // 4. Compute Comprehensive Employee Records with Live Timer Baselines
    let workingCount = 0;
    let onBreakCount = 0;
    let completedCount = 0;
    let notCheckedInCount = 0;
    let totalInPunches = 0;
    let totalOutPunches = 0;
    let totalWorkingSecondsSum = 0;
    let totalBreakSecondsSum = 0;

    const employeeRows = allEmployees.map((emp) => {
      const session = sessionByEmpId.get(emp.id.toString());
      const state = session?.status || 'NOT_CHECKED_IN';

      if (state === 'WORKING') workingCount++;
      else if (state === 'ON_BREAK') onBreakCount++;
      else if (state === 'COMPLETED') completedCount++;
      else notCheckedInCount++;

      if (session) {
        totalInPunches += session.in_count || 0;
        totalOutPunches += session.out_count || 0;
        totalWorkingSecondsSum += session.total_working_seconds || 0;
        totalBreakSecondsSum += session.total_break_seconds || 0;
      }

      return {
        id: emp.id.toString(),
        employeeCode: emp.employee_code,
        name: emp.name,
        department: emp.department_name || 'General Operations',
        designation: emp.designation || 'Staff',
        biometricNumber: emp.biometric_number,
        shiftName: emp.shift_name || 'US Overnight',
        // Timer Baselines
        sessionId: session?.id ? session.id.toString() : null,
        currentState: state,
        completionStatus: session?.completion_status || 'ACTIVE',
        firstInTime: session?.first_in_time ? new Date(session.first_in_time).toISOString() : null,
        lastInTime: session?.last_in_time ? new Date(session.last_in_time).toISOString() : null,
        lastOutTime: session?.last_out_time ? new Date(session.last_out_time).toISOString() : null,
        currentIntervalStart: session?.current_interval_start
          ? new Date(session.current_interval_start).toISOString()
          : null,
        inCount: session?.in_count || 0,
        outCount: session?.out_count || 0,
        completedBreakCount: session?.completed_break_count || 0,
        totalWorkingSeconds: session?.total_working_seconds || 0,
        totalBreakSeconds: session?.total_break_seconds || 0,
        totalElapsedSeconds: session?.total_elapsed_seconds || 0,
      };
    });

    // 5. Device Health & Connection Status
    const device = await queryOne<any>(
      `SELECT * FROM biometric_devices ORDER BY updated_at DESC LIMIT 1`
    );

    const isOnline = device?.last_connected_at
      ? Date.now() - new Date(device.last_connected_at).getTime() < 120000
      : false;

    return NextResponse.json({
      success: true,
      businessDate: currentBusinessDateStr,
      serverTimeUtc: now.toISOString(),
      currentTime: {
        ist: now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
        est: now.toLocaleTimeString('en-US', { timeZone: 'America/New_York' }),
      },
      kpis: {
        totalEmployees: allEmployees.length,
        workingCount,
        onBreakCount,
        completedCount,
        notCheckedInCount,
        todayPunchesCount: recentPunches.length,
        totalInPunches,
        totalOutPunches,
        totalWorkingHours: (totalWorkingSecondsSum / 3600).toFixed(1),
        totalBreakHours: (totalBreakSecondsSum / 3600).toFixed(1),
        deviceStatus: isOnline ? 'ONLINE' : device?.status || 'OFFLINE',
        deviceModel: device?.model || 'DS-K1T343EFWX',
        lastSync: device?.last_connected_at ? new Date(device.last_connected_at).toISOString() : null,
      },
      employees: employeeRows,
      recentPunches: recentPunches.map((p) => ({
        id: p.id.toString(),
        serialNo: p.serial_no,
        timeUtc: new Date(p.event_time_utc).toISOString(),
        timeDevice: p.event_time_device,
        employeeName: p.employee_name || `Biometric #${p.employee_no_string}`,
        employeeCode: p.employee_code || p.employee_no_string,
        biometricNumber: p.employee_no_string,
        department: p.department_name || 'General Operations',
        verifyMode: p.verify_mode || 'face',
        attendanceStatus: p.attendance_status || 'IN',
        source: p.ingestion_source,
        isConfirmed: Boolean(p.is_confirmed),
      })),
    });
  } catch (error: any) {
    console.error('[API /api/attendance/today Error]', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
