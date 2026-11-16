import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const departmentId = searchParams.get('departmentId');
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');
    const format = searchParams.get('format') || 'json';

    let sql = `
      SELECT s.*,
             e.name AS employee_name,
             e.employee_code,
             e.biometric_number,
             d.name AS department_name,
             sh.name AS shift_name
      FROM attendance_sessions s
      JOIN employees e ON s.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN shift_configurations sh ON e.shift_id = sh.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (startDate && endDate) {
      sql += ` AND s.business_date >= ? AND s.business_date <= ?`;
      params.push(startDate, endDate);
    } else if (startDate) {
      sql += ` AND s.business_date >= ?`;
      params.push(startDate);
    }

    if (employeeId) {
      sql += ` AND s.employee_id = ?`;
      params.push(employeeId);
    }
    if (status) {
      sql += ` AND s.status = ?`;
      params.push(status);
    }
    if (departmentId) {
      sql += ` AND e.department_id = ?`;
      params.push(departmentId);
    }

    sql += ` ORDER BY s.business_date DESC, e.name ASC`;

    const sessions = await query<any>(sql, params);

    const reportData = sessions.map((s) => {
      const bDateStr =
        s.business_date instanceof Date
          ? s.business_date.toISOString().split('T')[0]
          : String(s.business_date).split('T')[0];

      const firstIn = s.first_in_time
        ? new Date(s.first_in_time).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
        : '-';

      const lastOut = s.last_out_time
        ? new Date(s.last_out_time).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
        : '-';

      const totalWorkMins = s.total_work_minutes || 0;

      return {
        businessDate: bDateStr,
        employeeName: s.employee_name,
        employeeCode: s.employee_code,
        biometricNumber: s.biometric_number,
        department: s.department_name || 'General',
        shift: s.shift_name || 'US Overnight',
        firstInTime: firstIn,
        lastOutTime: lastOut,
        totalWorkHours: (totalWorkMins / 60).toFixed(2),
        lateMinutes: s.late_minutes || 0,
        earlyExitMinutes: s.early_exit_minutes || 0,
        overtimeMinutes: s.overtime_minutes || 0,
        status: s.status,
        notes: s.notes || '',
      };
    });

    if (format === 'csv') {
      const headers = [
        'Business Date',
        'Employee Name',
        'Employee Code',
        'Biometric ID',
        'Department',
        'Shift',
        'In Time (IST)',
        'Out Time (IST)',
        'Total Work Hours',
        'Late Mins',
        'Early Exit Mins',
        'Overtime Mins',
        'Status',
        'Notes',
      ];
      const rows = reportData.map((r) => [
        r.businessDate,
        `"${r.employeeName}"`,
        r.employeeCode,
        r.biometricNumber,
        `"${r.department}"`,
        `"${r.shift}"`,
        r.firstInTime,
        r.lastOutTime,
        r.totalWorkHours,
        r.lateMinutes,
        r.earlyExitMinutes,
        r.overtimeMinutes,
        r.status,
        `"${r.notes}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="attendance-report-${startDate || 'all'}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      count: reportData.length,
      data: reportData,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
