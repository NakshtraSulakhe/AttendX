import { query, getPool } from '../src/lib/database';

async function main() {
  const events = await query<any>(
    'SELECT * FROM biometric_raw_events ORDER BY event_time_utc DESC LIMIT 5'
  );

  console.log('--- RECENT 5 RAW BIOMETRIC EVENTS ---');
  for (const e of events) {
    console.log({
      id: e.id.toString(),
      serialNo: e.serial_no,
      timeUtc: e.event_time_utc ? new Date(e.event_time_utc).toISOString() : null,
      timeDevice: e.event_time_device,
      employeeNoString: e.employee_no_string,
      verifyMode: e.verify_mode,
      attendanceStatus: e.attendance_status,
      rawPayload: e.raw_payload,
    });
  }
}

main().finally(() => getPool().end());
