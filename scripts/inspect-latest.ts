import { HikvisionISAPIClient } from '../connector/src/hikvision-client';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const client = new HikvisionISAPIClient({
    ip: '192.168.200.200',
    port: 80,
    username: 'admin',
    password: process.env.HIKVISION_PASSWORD || 'Taraj@2026',
  });

  // Search events from 5:00 PM onwards today (2026-10-30)
  const res = await client.searchAcsEvents({
    startTime: '2026-10-30T17:00:00+05:30',
    endTime: '2026-10-30T23:59:59+05:30',
    maxResults: 100,
  });

  const list = res.InfoList || [];
  console.log(`Found ${res.totalMatches} matches, returned ${list.length}`);
  
  // Find all events with employee 040 or name Nakshtra
  const empEvents = list.filter((e: any) => 
    e.employeeNoString === '040' || 
    e.employeeNoString === '40' || 
    (e.name && e.name.toLowerCase().includes('nakshtra'))
  );

  console.log(`Events specifically for Nakshtra / 040: ${empEvents.length}`);
  for (const e of empEvents) {
    console.log(`  Serial: ${e.serialNo}, Time: ${e.time}, Reader: ${e.cardReaderNo}, Major: ${e.major}, Minor: ${e.minor}, Card: ${e.cardNo}`);
  }

  console.log('\nLast 10 general events on machine:');
  list.slice(-10).forEach((e: any) => {
    console.log(`  Serial: ${e.serialNo}, Time: ${e.time}, Emp: ${e.employeeNoString || 'none'}, Name: ${e.name || 'none'}, Minor: ${e.minor}`);
  });
}

main().catch(console.error);
