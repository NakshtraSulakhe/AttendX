import { query, queryOne, execute, getDbPool } from '../src/lib/db';

export async function syncEmployeesFromDeviceEvents() {
  console.log('[EmployeeSync] Synchronizing employees from verified device punch logs...');

  // Get default overnight shift
  const defaultShift = await queryOne<any>(
    `SELECT id, name FROM shift_configurations WHERE is_default = 1 LIMIT 1`
  );

  // Get distinct raw events with employeeNoString
  const rawPunches = await query<any>(
    `SELECT DISTINCT employee_no_string, card_no, raw_payload
     FROM biometric_raw_events
     WHERE employee_no_string != '' AND employee_no_string IS NOT NULL`
  );

  console.log(`[EmployeeSync] Discovered ${rawPunches.length} distinct employees on machine.`);

  let createdCount = 0;
  let updatedCount = 0;

  for (const p of rawPunches) {
    let raw: any = {};
    try {
      raw = typeof p.raw_payload === 'string' ? JSON.parse(p.raw_payload) : p.raw_payload || {};
    } catch {
      raw = {};
    }
    const name = raw.name || `Employee #${p.employee_no_string}`;

    const existing = await queryOne<any>(
      `SELECT id, name FROM employees WHERE biometric_number = ? LIMIT 1`,
      [p.employee_no_string]
    );

    if (!existing) {
      const candidateCode = `EMP${p.employee_no_string.padStart(4, '0')}`;
      const insertRes = await execute(
        `INSERT INTO employees (
          employee_code, name, biometric_number, designation, status,
          shift_id, date_of_joining, created_at, updated_at
        ) VALUES (?, ?, ?, 'Operations Staff', 'ACTIVE', ?, '2024-01-01', NOW(), NOW())`,
        [candidateCode, name.trim(), p.employee_no_string, defaultShift ? defaultShift.id.toString() : null]
      );
      createdCount++;
      console.log(`  ➕ Enrolled: ${name.trim()} (Bio ID: ${p.employee_no_string})`);

      await execute(
        `UPDATE biometric_raw_events
         SET employee_id = ?
         WHERE employee_no_string = ? AND employee_id IS NULL`,
        [insertRes.insertId, p.employee_no_string]
      );
    } else {
      if (existing.name.startsWith('Biometric #') || existing.name !== name.trim()) {
        await execute(
          `UPDATE employees SET name = ?, updated_at = NOW() WHERE id = ?`,
          [name.trim(), existing.id]
        );
        updatedCount++;
      }

      await execute(
        `UPDATE biometric_raw_events
         SET employee_id = ?
         WHERE employee_no_string = ? AND employee_id IS NULL`,
        [existing.id, p.employee_no_string]
      );
    }
  }

  console.log(`[EmployeeSync] Complete! Created: ${createdCount}, Updated: ${updatedCount}`);
}

if (require.main === module) {
  syncEmployeesFromDeviceEvents()
    .catch(console.error)
    .finally(() => getDbPool().end());
}
