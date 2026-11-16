import { execute, getDbPool } from '../src/lib/db';

async function main() {
  console.log('[Seed] Seeding default shifts and device profile using native MySQL...');

  // 1. Overnight Shift (Default)
  await execute(`
    INSERT INTO shift_configurations (
      name, code, is_overnight, shift_start_local, shift_end_local,
      timezone, duration_minutes, grace_late_minutes, grace_early_exit_minutes,
      overtime_min_minutes, is_default, is_active, created_at, updated_at
    ) VALUES (
      'US Operations Overnight Shift', 'US_OVERNIGHT_IST', 1, '17:30:00', '02:30:00',
      'Asia/Kolkata', 540, 15, 15,
      30, 1, 1, NOW(), NOW()
    )
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      is_overnight = VALUES(is_overnight),
      shift_start_local = VALUES(shift_start_local),
      shift_end_local = VALUES(shift_end_local),
      timezone = VALUES(timezone),
      duration_minutes = VALUES(duration_minutes),
      grace_late_minutes = VALUES(grace_late_minutes),
      grace_early_exit_minutes = VALUES(grace_early_exit_minutes),
      overtime_min_minutes = VALUES(overtime_min_minutes),
      is_default = VALUES(is_default),
      is_active = VALUES(is_active),
      updated_at = NOW()
  `);

  // 2. Day General Shift
  await execute(`
    INSERT INTO shift_configurations (
      name, code, is_overnight, shift_start_local, shift_end_local,
      timezone, duration_minutes, grace_late_minutes, grace_early_exit_minutes,
      overtime_min_minutes, is_default, is_active, created_at, updated_at
    ) VALUES (
      'Day General Shift', 'DAY_GENERAL_IST', 0, '10:00:00', '19:00:00',
      'Asia/Kolkata', 540, 15, 15,
      30, 0, 1, NOW(), NOW()
    )
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      is_overnight = VALUES(is_overnight),
      shift_start_local = VALUES(shift_start_local),
      shift_end_local = VALUES(shift_end_local),
      timezone = VALUES(timezone),
      duration_minutes = VALUES(duration_minutes),
      grace_late_minutes = VALUES(grace_late_minutes),
      grace_early_exit_minutes = VALUES(grace_early_exit_minutes),
      overtime_min_minutes = VALUES(overtime_min_minutes),
      is_default = VALUES(is_default),
      is_active = VALUES(is_active),
      updated_at = NOW()
  `);

  // 3. Register Physical Biometric Machine
  const serialNo = 'DS-K1T343EFWX20241225V032100ENFV1881098';
  await execute(
    `INSERT INTO biometric_devices (
      name, model, serial_number, ip_address, port, use_https,
      timezone, sync_interval_seconds, connection_method, status,
      firmware_version, last_connected_at, created_at, updated_at
    ) VALUES (
      'Taraj Global Solutions Terminal', 'DS-K1T343EFWX', ?, '192.168.200.200', 80, 0,
      'Asia/Kolkata', 10, 'ISAPI_STREAM', 'ONLINE',
      'V3.21.0 build 241225', NOW(), NOW(), NOW()
    )
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      status = 'ONLINE',
      last_connected_at = NOW(),
      updated_at = NOW()`,
    [serialNo]
  );

  console.log('✅ Default shifts & biometric device successfully seeded!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => getDbPool().end());
