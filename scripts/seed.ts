import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { execute, query, queryOne, getPool } from '../src/lib/database';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
  console.log('====================================================');
  console.log('   AttendX Enterprise Seed Runner (Native MySQL)    ');
  console.log('====================================================\n');

  // 1. Run SQL seed files from database/seeds/
  const seedsDir = path.resolve(process.cwd(), 'database', 'seeds');
  if (fs.existsSync(seedsDir)) {
    const seedFiles = fs.readdirSync(seedsDir).filter(f => f.endsWith('.sql')).sort();
    for (const file of seedFiles) {
      console.log(`  📄 Applying seed file: ${file}...`);
      const filePath = path.join(seedsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf-8');
      const cleanSql = sqlContent
        .replace(/--.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//gm, '');
      const statements = cleanSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        await execute(statement);
      }
      console.log(`  ✅ Successfully executed: ${file} (${statements.length} statements)`);
    }
  }

  // 2. Default Shift Configurations
  console.log('\n  ⚙️  Seeding shift configurations...');
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
  console.log('  📟 Seeding biometric terminal profile...');
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

  // 4. Role Permissions Mapping
  console.log('  🔐 Mapping role permissions...');
  const allRoles = await query<{ id: number; code: string }>('SELECT id, code FROM roles');
  const allPerms = await query<{ id: number; action_key: string }>('SELECT id, action_key FROM permissions');

  const roleMap = new Map(allRoles.map(r => [r.code, r.id]));
  const permMap = new Map(allPerms.map(p => [p.action_key, p.id]));

  const roleAssignments: Record<string, string[]> = {
    SUPER_ADMIN: Array.from(permMap.keys()), // All permissions
    HR_ADMIN: [
      'employee.view', 'employee.create', 'employee.update', 'employee.delete',
      'attendance.view', 'attendance.correct', 'attendance.approve', 'attendance.export',
      'shift.view', 'shift.create', 'shift.assign',
      'leave.apply', 'leave.approve', 'leave.manage',
      'overtime.view', 'overtime.approve',
      'reports.view', 'reports.export',
      'device.view'
    ],
    BRANCH_ADMIN: [
      'employee.view', 'employee.update',
      'attendance.view', 'attendance.correct', 'attendance.approve', 'attendance.export',
      'shift.view', 'shift.assign',
      'leave.approve', 'overtime.approve',
      'reports.view', 'reports.export',
      'device.view'
    ],
    MANAGER: [
      'employee.view',
      'attendance.view', 'attendance.approve',
      'shift.view',
      'leave.apply', 'leave.approve',
      'overtime.view', 'overtime.approve',
      'reports.view'
    ],
    TEAM_LEADER: [
      'employee.view',
      'attendance.view', 'attendance.correct',
      'leave.apply',
      'reports.view'
    ],
    EMPLOYEE: [
      'attendance.view', 'attendance.correct',
      'leave.apply'
    ],
    AUDITOR: [
      'employee.view',
      'attendance.view', 'attendance.export',
      'shift.view',
      'leave.manage',
      'overtime.view',
      'reports.view', 'reports.export',
      'device.view'
    ]
  };

  for (const [roleCode, perms] of Object.entries(roleAssignments)) {
    const roleId = roleMap.get(roleCode);
    if (!roleId) continue;

    for (const permKey of perms) {
      const permId = permMap.get(permKey);
      if (permId) {
        await execute(
          'INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
          [roleId, permId]
        );
      }
    }
  }

  // 5. Default Enterprise Admin User
  console.log('  👤 Seeding default Super Admin user account...');
  const adminEmail = 'admin@attendx.com';
  const existingAdmin = await queryOne<{ id: number }>('SELECT id FROM users WHERE email = ?', [adminEmail]);

  const saltRounds = 10;
  const adminPasswordHash = await bcrypt.hash('Admin@123456', saltRounds);

  let adminUserId: number;
  if (!existingAdmin) {
    const result = await execute(
      `INSERT INTO users (email, password_hash, display_name, role, is_active, created_at, updated_at)
       VALUES (?, ?, 'Super Administrator', 'SUPER_ADMIN', 1, NOW(), NOW())`,
      [adminEmail, adminPasswordHash]
    );
    adminUserId = result.insertId;
    console.log(`     ✅ Created super admin: ${adminEmail} (Default Password: Admin@123456)`);
  } else {
    adminUserId = existingAdmin.id;
    await execute(
      'UPDATE users SET password_hash = ?, is_active = 1, updated_at = NOW() WHERE id = ?',
      [adminPasswordHash, adminUserId]
    );
    console.log(`     ℹ️  Super admin exists, updated password: ${adminEmail}`);
  }

  const superAdminRoleId = roleMap.get('SUPER_ADMIN');
  if (superAdminRoleId && adminUserId) {
    await execute(
      'INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)',
      [adminUserId, superAdminRoleId]
    );
  }

  // 6. Demo HR Admin Account
  const hrEmail = 'hr@attendx.com';
  const existingHr = await queryOne<{ id: number }>('SELECT id FROM users WHERE email = ?', [hrEmail]);
  const hrPasswordHash = await bcrypt.hash('HrAdmin@123456', saltRounds);
  let hrUserId: number;
  if (!existingHr) {
    const result = await execute(
      `INSERT INTO users (email, password_hash, display_name, role, is_active, created_at, updated_at)
       VALUES (?, ?, 'HR Administrator', 'HR_ADMIN', 1, NOW(), NOW())`,
      [hrEmail, hrPasswordHash]
    );
    hrUserId = result.insertId;
    console.log(`     ✅ Created HR admin: ${hrEmail} (Default Password: HrAdmin@123456)`);
  } else {
    hrUserId = existingHr.id;
    await execute(
      'UPDATE users SET password_hash = ?, role = "HR_ADMIN", is_active = 1, updated_at = NOW() WHERE id = ?',
      [hrPasswordHash, hrUserId]
    );
  }
  const hrRoleId = roleMap.get('HR_ADMIN');
  if (hrRoleId && hrUserId) {
    await execute(
      'INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)',
      [hrUserId, hrRoleId]
    );
  }

  console.log('\n====================================================');
  console.log('   ✅ All Enterprise Data Successfully Seeded!     ');
  console.log('====================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed execution failed:', e);
    process.exit(1);
  })
  .finally(() => getPool().end());
