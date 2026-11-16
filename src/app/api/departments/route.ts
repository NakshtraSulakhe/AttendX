import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/database';

export async function GET(req: NextRequest) {
  try {
    // If no departments exist, initialize default departments
    const countRow = await query<{ count: number }>('SELECT COUNT(*) as count FROM departments');
    if (!countRow[0] || countRow[0].count === 0) {
      await execute(`
        INSERT INTO departments (name, code, created_at, updated_at) VALUES
          ('General Operations', 'GEN_OPS', NOW(), NOW()),
          ('Technical & Engineering', 'TECH_ENG', NOW(), NOW()),
          ('Workforce & HR Management', 'HR_OPS', NOW(), NOW())
        ON DUPLICATE KEY UPDATE name = VALUES(name)
      `);
    }

    const rows = await query<any>(`
      SELECT 
        d.id,
        d.name,
        d.code,
        COUNT(e.id) as headcount,
        COUNT(CASE WHEN s.status IN ('WORKING', 'ON_BREAK') THEN 1 END) as active_count
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id
      LEFT JOIN attendance_sessions s ON s.employee_id = e.id AND s.business_date = CURRENT_DATE()
      GROUP BY d.id, d.name, d.code
      ORDER BY d.name ASC
    `);

    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id.toString(),
        name: r.name,
        code: r.code,
        headcount: Number(r.headcount || 0),
        activeCount: Number(r.active_count || 0),
        shift: 'US Operations Overnight Shift (17:30 - 02:30 IST)',
      })),
    });
  } catch (err: any) {
    console.error('[API /api/departments GET] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, code } = body;

    if (!name || !code) {
      return NextResponse.json(
        { success: false, error: 'Department name and code are required' },
        { status: 400 }
      );
    }

    const res = await execute(
      'INSERT INTO departments (name, code, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
      [name, code]
    );

    return NextResponse.json({ success: true, insertId: res.insertId });
  } catch (err: any) {
    console.error('[API /api/departments POST] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
