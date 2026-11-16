import { query, getDbPool } from '../src/lib/db';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
  console.log('Testing MySQL connection via src/lib/db.ts ...');
  try {
    const result = await query<{ currentTime: string; version: string }>(
      'SELECT NOW() as currentTime, VERSION() as version'
    );
    console.log('✅ Connected successfully!');
    console.log('Server info:', result[0]);

    const tables = await query<{ table_name: string }>(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()'
    );
    console.log('\nExisting database tables:');
    tables.forEach((t) => console.log(' -', (t as any).TABLE_NAME || (t as any).table_name));

    const empCount = await query<{ count: number }>('SELECT COUNT(*) as count FROM employees');
    console.log('\nEmployee count:', empCount[0].count);

    const eventCount = await query<{ count: number }>('SELECT COUNT(*) as count FROM biometric_raw_events');
    console.log('Raw event count:', eventCount[0].count);

    const sessionCount = await query<{ count: number }>('SELECT COUNT(*) as count FROM attendance_sessions');
    console.log('Attendance session count:', sessionCount[0].count);
  } catch (err: any) {
    console.error('❌ Database connection test failed:', err);
  } finally {
    const pool = getDbPool();
    await pool.end();
  }
}

main();
