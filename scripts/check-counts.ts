import { query, queryOne, getPool } from '../src/lib/database';

async function main() {
  const totalRawEvents = (await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM biometric_raw_events'))?.count || 0;
  const rawEventsToday = (await queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM biometric_raw_events WHERE event_time_utc >= ?',
    [new Date('2026-10-30T00:00:00Z')]
  ))?.count || 0;
  const rawEventsAfterNoonToday = (await queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM biometric_raw_events WHERE event_time_utc >= ?',
    [new Date('2026-10-30T06:30:00Z')]
  ))?.count || 0;

  const latestEvent = await queryOne<{ serial_no: number; event_time_device: string; employee_no_string: string }>(
    'SELECT serial_no, event_time_device, employee_no_string FROM biometric_raw_events ORDER BY event_time_utc DESC LIMIT 1'
  );

  const totalSessions = (await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM attendance_sessions'))?.count || 0;
  const sessionsToday = (await queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM attendance_sessions WHERE business_date = ?',
    ['2026-10-30']
  ))?.count || 0;

  console.log('Database Stats:');
  console.log(`- Total Raw Events: ${totalRawEvents}`);
  console.log(`- Raw Events on 2026-10-30 (all day): ${rawEventsToday}`);
  console.log(`- Raw Events after 12:00 PM IST today: ${rawEventsAfterNoonToday}`);
  console.log(`- Latest Raw Event in DB: Serial ${latestEvent?.serial_no}, Device Time: ${latestEvent?.event_time_device}, Emp: ${latestEvent?.employee_no_string}`);
  console.log(`- Total Sessions: ${totalSessions}`);
  console.log(`- Sessions for Business Date 2026-10-30: ${sessionsToday}`);
}

main().finally(() => getPool().end());

