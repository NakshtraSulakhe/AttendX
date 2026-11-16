import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const corrections = await query<any>(
      `SELECT c.*,
              e.name AS employee_name,
              e.employee_code,
              e.biometric_number,
              d.name AS department_name
       FROM attendance_corrections c
       JOIN employees e ON c.employee_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       ORDER BY c.created_at DESC
       LIMIT 50`
    );

    const data = corrections.map((c) => {
      const bDateStr =
        c.business_date instanceof Date
          ? c.business_date.toISOString().split('T')[0]
          : String(c.business_date).split('T')[0];

      return {
        id: c.id.toString(),
        employeeName: c.employee_name,
        employeeCode: c.employee_code,
        biometricNumber: c.biometric_number,
        department: c.department_name || 'General Operations',
        businessDate: bDateStr,
        previousInTime: c.previous_in_time
          ? new Date(c.previous_in_time).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
          : '-',
        newInTime: c.new_in_time
          ? new Date(c.new_in_time).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
          : '-',
        previousOutTime: c.previous_out_time
          ? new Date(c.previous_out_time).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
          : '-',
        newOutTime: c.new_out_time
          ? new Date(c.new_out_time).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
          : '-',
        reason: c.reason,
        createdAt: new Date(c.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      };
    });

    return NextResponse.json({ success: true, corrections: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
