import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const departmentId = searchParams.get('departmentId');
    const status = searchParams.get('status');

    let sql = `
      SELECT e.*,
             d.name AS department_name,
             s.name AS shift_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN shift_configurations s ON e.shift_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      sql += ` AND (e.name LIKE ? OR e.employee_code LIKE ? OR e.biometric_number LIKE ?)`;
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    if (departmentId) {
      sql += ` AND e.department_id = ?`;
      params.push(departmentId);
    }

    if (status) {
      sql += ` AND e.status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY e.name ASC`;

    const employees = await query<any>(sql, params);
    const departments = await query<any>(`SELECT id, name, code FROM departments ORDER BY name ASC`);
    const shifts = await query<any>(
      `SELECT id, name, code, is_overnight FROM shift_configurations ORDER BY name ASC`
    );

    return NextResponse.json({
      success: true,
      employees: employees.map((e) => {
        const dojStr =
          e.date_of_joining instanceof Date
            ? e.date_of_joining.toISOString().split('T')[0]
            : String(e.date_of_joining || '2024-01-01').split('T')[0];

        return {
          id: e.id.toString(),
          employeeCode: e.employee_code,
          name: e.name,
          email: e.email,
          phone: e.phone,
          department: e.department_name || 'Unassigned',
          designation: e.designation || 'Staff',
          biometricNumber: e.biometric_number,
          status: e.status,
          shift: e.shift_name || 'Default US Overnight',
          dateOfJoining: dojStr,
        };
      }),
      departments: departments.map((d) => ({
        id: d.id.toString(),
        name: d.name,
        code: d.code,
      })),
      shifts: shifts.map((s) => ({
        id: s.id.toString(),
        name: s.name,
        code: s.code,
        isOvernight: Boolean(s.is_overnight),
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      employeeCode,
      name,
      email,
      phone,
      departmentId,
      designation,
      biometricNumber,
      shiftId,
      dateOfJoining,
    } = body;

    if (!employeeCode || !name || !biometricNumber) {
      return NextResponse.json(
        { error: 'Employee Code, Name, and Biometric Number are required' },
        { status: 400 }
      );
    }

    const doj = dateOfJoining ? String(dateOfJoining).split('T')[0] : '2024-01-01';

    const insertRes = await execute(
      `INSERT INTO employees (
        employee_code, name, email, phone, department_id,
        designation, biometric_number, shift_id, date_of_joining,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', NOW(), NOW())`,
      [
        employeeCode,
        name,
        email || null,
        phone || null,
        departmentId ? departmentId.toString() : null,
        designation || null,
        biometricNumber,
        shiftId ? shiftId.toString() : null,
        doj,
      ]
    );

    const createdEmp = await queryOne<any>(
      `SELECT e.*, d.name AS department_name, s.name AS shift_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN shift_configurations s ON e.shift_id = s.id
       WHERE e.id = ?`,
      [insertRes.insertId]
    );

    return NextResponse.json({ success: true, employee: createdEmp });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
