import { query, queryOne, getPool } from '../src/lib/database';

async function main() {
  const shifts = await query<any>('SELECT * FROM shift_configurations');
  console.log('--- SHIFTS IN DB ---');
  for (const s of shifts) {
    const empCount = (await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM employees WHERE shift_id = ?',
      [s.id]
    ))?.count || 0;
    console.log({
      id: s.id.toString(),
      name: s.name,
      code: s.code,
      isOvernight: s.is_overnight,
      startTimeLocal: s.start_time_local,
      endTimeLocal: s.end_time_local,
      timezone: s.timezone,
      durationMinutes: s.duration_minutes,
      employeesCount: empCount,
      isDefault: s.is_default,
    });
  }

  const unassigned = (await queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM employees WHERE shift_id IS NULL'
  ))?.count || 0;
  console.log(`Employees without shift: ${unassigned}`);
}

main().finally(() => getPool().end());

