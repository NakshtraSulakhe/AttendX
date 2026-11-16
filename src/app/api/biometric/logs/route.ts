import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const search = searchParams.get('search') || '';

    let sql = `
      SELECT r.*,
             e.name AS employee_name,
             e.employee_code,
             d.name AS department_name,
             dev.name AS device_name
      FROM biometric_raw_events r
      LEFT JOIN employees e ON r.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN biometric_devices dev ON r.device_id = dev.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      sql += ` AND (r.employee_no_string LIKE ? OR e.name LIKE ? OR e.employee_code LIKE ?)`;
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    // Append limit directly (safely bounded) to avoid MySQL prepared statement LIMIT parameter quirks
    const safeLimit = Math.max(1, Math.min(limit, 1000));
    sql += ` ORDER BY r.event_time_utc DESC LIMIT ${safeLimit}`;

    const events = await query<any>(sql, params);

    const formatted = events.map((ev, index) => {
      const eventTime = new Date(ev.event_time_utc);

      return {
        sequence: index + 1,
        id: ev.id.toString(),
        serialNo: ev.serial_no,
        timeUtc: eventTime.toISOString(),
        timeDevice: ev.event_time_device,
        timeIst: eventTime.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        dateIst: eventTime.toLocaleDateString('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        employeeName: ev.employee_name || `Unmapped (Bio #${ev.employee_no_string})`,
        employeeCode: ev.employee_code || ev.employee_no_string,
        biometricNumber: ev.employee_no_string,
        department: ev.department_name || 'General Operations',
        verifyMode: ev.verify_mode || 'face',
        attendanceStatus: ev.attendance_status || (ev.minor_code === 75 ? 'IN' : 'IN/OUT'),
        deviceName: ev.device_name || 'Taraj Hikvision Entrance',
        source: ev.ingestion_source,
        isProcessed: Boolean(ev.is_processed),
      };
    });

    return NextResponse.json({
      success: true,
      count: formatted.length,
      events: formatted,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
