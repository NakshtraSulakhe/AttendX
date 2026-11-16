import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/database';

export async function GET(req: NextRequest) {
  try {
    const shifts = await query<any>(`
      SELECT 
        s.*,
        (SELECT COUNT(*) FROM employees e WHERE e.shift_id = s.id) as assigned_count
      FROM shift_configurations s
      ORDER BY s.is_default DESC, s.name ASC
    `);

    return NextResponse.json({
      success: true,
      data: shifts.map((s) => ({
        id: s.id.toString(),
        name: s.name,
        code: s.code,
        isOvernight: Boolean(s.is_overnight),
        startTime: s.shift_start_local,
        endTime: s.shift_end_local,
        durationMinutes: s.duration_minutes,
        timezone: s.timezone,
        graceLateMinutes: s.grace_late_minutes,
        graceEarlyExitMinutes: s.grace_early_exit_minutes,
        overtimeMinMinutes: s.overtime_min_minutes,
        isDefault: Boolean(s.is_default),
        isActive: Boolean(s.is_active),
        assignedCount: Number(s.assigned_count || 0),
        status: s.is_default ? 'PRIMARY ACTIVE SHIFT' : s.is_active ? 'ACTIVE SHIFT' : 'INACTIVE',
      })),
    });
  } catch (err: any) {
    console.error('[API /api/shifts GET] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      code,
      isOvernight,
      startTime,
      endTime,
      timezone = 'Asia/Kolkata',
      durationMinutes = 540,
      graceLateMinutes = 15,
      graceEarlyExitMinutes = 15,
      overtimeMinMinutes = 30,
      isDefault = 0,
    } = body;

    if (!name || !code || !startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: 'Name, code, startTime, and endTime are required' },
        { status: 400 }
      );
    }

    const res = await execute(
      `INSERT INTO shift_configurations (
        name, code, is_overnight, shift_start_local, shift_end_local,
        timezone, duration_minutes, grace_late_minutes, grace_early_exit_minutes,
        overtime_min_minutes, is_default, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [
        name,
        code,
        isOvernight ? 1 : 0,
        startTime,
        endTime,
        timezone,
        durationMinutes,
        graceLateMinutes,
        graceEarlyExitMinutes,
        overtimeMinMinutes,
        isDefault ? 1 : 0,
      ]
    );

    return NextResponse.json({ success: true, insertId: res.insertId });
  } catch (err: any) {
    console.error('[API /api/shifts POST] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
