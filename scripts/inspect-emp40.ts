import { HikvisionISAPIClient } from '../connector/src/hikvision-client';
import { query, queryOne, getPool } from '../src/lib/database';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  console.log('=== 1. Checking Hikvision Device directly for Employee 040 ===');
  const client = new HikvisionISAPIClient({
    ip: '192.168.200.200',
    port: 80,
    username: 'admin',
    password: process.env.HIKVISION_PASSWORD || 'Taraj@2026',
  });

  const res = await client.searchAcsEvents({
    startTime: '2026-10-28T00:00:00+05:30',
    endTime: '2026-10-28T23:59:59+05:30',
    maxResults: 150,
  });

  const events = res.InfoList || [];
  console.log(`Device total events for today: ${res.totalMatches}, fetched: ${events.length}`);
  const userEvents = events.filter(
    (e: any) =>
      e.employeeNoString === '040' ||
      e.employeeNoString === '40' ||
      (e.name && e.name.toLowerCase().includes('nakshtra'))
  );

  console.log(`Punches found on machine for 040/Nakshtra: ${userEvents.length}`);
  for (const e of userEvents) {
    console.log(`  - Serial: ${e.serialNo}, Time: ${e.time}, Reader: ${e.cardReaderNo}, Name: ${e.name}, Major: ${e.major}, Minor: ${e.minor}`);
  }

  console.log('\n=== 2. Checking Database for Employee 040 ===');
  const emp = await queryOne<any>(
    `SELECT e.*, s.name as shift_name 
     FROM employees e 
     LEFT JOIN shift_configurations s ON e.shift_id = s.id 
     WHERE e.biometric_number = '040' OR e.biometric_number = '40' OR e.employee_code = 'EMP0040' OR e.name LIKE '%Nakshtra%' 
     LIMIT 1`
  );
  console.log('Employee in DB:', emp ? { id: emp.id.toString(), name: emp.name, code: emp.employee_code, bioNum: emp.biometric_number, shift: emp.shift_name } : 'NOT FOUND');

  const rawEvents = await query<any>(
    `SELECT * FROM biometric_raw_events 
     WHERE employee_no_string = '040' OR employee_no_string = '40' ${emp ? 'OR employee_id = ' + emp.id : ''} 
     ORDER BY event_time_utc ASC`
  );
  console.log(`Raw events in DB for 040: ${rawEvents.length}`);
  for (const r of rawEvents) {
    console.log(`  - DB Raw ID: ${r.id}, Serial: ${r.serial_no}, DeviceTime: ${r.event_time_device}, EmpId: ${r.employee_id}`);
  }

  const sessions = emp ? await query<any>(
    'SELECT * FROM attendance_sessions WHERE employee_id = ? ORDER BY business_date DESC',
    [emp.id]
  ) : [];
  console.log(`Sessions in DB for Emp ${emp?.id}: ${sessions.length}`);
  for (const s of sessions) {
    console.log(`  - Session ID: ${s.id}, Date: ${s.business_date ? new Date(s.business_date).toISOString().split('T')[0] : 'N/A'}, Status: ${s.status}, In: ${s.in_count}, Out: ${s.out_count}, FirstIn: ${s.first_in_time}, LastOut: ${s.last_out_time}`);
  }
}

main().finally(() => getPool().end());
