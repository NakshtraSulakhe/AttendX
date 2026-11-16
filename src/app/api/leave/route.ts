import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/database';

export async function GET(req: NextRequest) {
  try {
    const leaveTypes = await query<any>('SELECT * FROM leave_types ORDER BY name ASC');
    const requests = await query<any>(`
      SELECT 
        lr.*,
        e.name as employee_name,
        e.employee_code,
        lt.name as leave_type_name,
        lt.code as leave_type_code
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      ORDER BY lr.created_at DESC
      LIMIT 100
    `);

    return NextResponse.json({
      success: true,
      leaveTypes: leaveTypes.map((lt) => ({
        id: lt.id.toString(),
        name: lt.name,
        code: lt.code,
        annualQuota: lt.annual_quota,
        isPaid: Boolean(lt.is_paid),
      })),
      requests: requests.map((r) => ({
        id: r.id.toString(),
        employeeId: r.employee_id.toString(),
        employeeName: r.employee_name,
        employeeCode: r.employee_code,
        leaveTypeName: r.leave_type_name,
        leaveTypeCode: r.leave_type_code,
        startDate: r.start_date,
        endDate: r.end_date,
        durationDays: Number(r.duration_days),
        reason: r.reason,
        status: r.status,
        createdAt: r.created_at,
      })),
    });
  } catch (err: any) {
    console.error('[API /api/leave GET] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employeeId, leaveTypeId, startDate, endDate, durationDays, reason } = body;

    if (!employeeId || !leaveTypeId || !startDate || !endDate || !reason) {
      return NextResponse.json(
        { success: false, error: 'employeeId, leaveTypeId, startDate, endDate, and reason are required' },
        { status: 400 }
      );
    }

    const res = await execute(
      `INSERT INTO leave_requests (
        employee_id, leave_type_id, start_date, end_date, duration_days, reason, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', NOW(), NOW())`,
      [employeeId, leaveTypeId, startDate, endDate, durationDays || 1, reason]
    );

    return NextResponse.json({ success: true, insertId: res.insertId });
  } catch (err: any) {
    console.error('[API /api/leave POST] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { requestId, status, approverRemarks } = body;

    if (!requestId || !status || !['APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Valid requestId and status required' }, { status: 400 });
    }

    await execute(
      'UPDATE leave_requests SET status = ?, approver_remarks = ?, updated_at = NOW() WHERE id = ?',
      [status, approverRemarks || null, requestId]
    );

    return NextResponse.json({ success: true, message: `Leave request ${status.toLowerCase()}` });
  } catch (err: any) {
    console.error('[API /api/leave PATCH] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
