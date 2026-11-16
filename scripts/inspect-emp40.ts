import { HikvisionISAPIClient } from '../connector/src/hikvision-client';
import { prisma } from '../src/lib/prisma';
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
  const emp = await prisma.employee.findFirst({
    where: {
      OR: [
        { biometricNumber: '040' },
        { biometricNumber: '40' },
        { employeeCode: 'EMP0040' },
        { name: { contains: 'Nakshtra' } },
      ],
    },
    include: { shift: true },
  });
  console.log('Employee in DB:', emp ? { id: emp.id.toString(), name: emp.name, code: emp.employeeCode, bioNum: emp.biometricNumber, shift: emp.shift?.name } : 'NOT FOUND');

  const rawEvents = await prisma.biometricRawEvent.findMany({
    where: {
      OR: [
        { employeeNoString: '040' },
        { employeeNoString: '40' },
        { employeeId: emp ? emp.id : undefined },
      ],
    },
    orderBy: { eventTimeUtc: 'asc' },
  });
  console.log(`Raw events in DB for 040: ${rawEvents.length}`);
  for (const r of rawEvents) {
    console.log(`  - DB Raw ID: ${r.id}, Serial: ${r.serialNo}, DeviceTime: ${r.eventTimeDevice}, EmpId: ${r.employeeId}`);
  }

  const sessions = await prisma.attendanceSession.findMany({
    where: { employeeId: emp?.id },
    orderBy: { businessDate: 'desc' },
  });
  console.log(`Sessions in DB for Emp ${emp?.id}: ${sessions.length}`);
  for (const s of sessions) {
    console.log(`  - Session ID: ${s.id}, Date: ${s.businessDate.toISOString().split('T')[0]}, Status: ${s.status}, In: ${s.inCount}, Out: ${s.outCount}, FirstIn: ${s.firstInTime}, LastOut: ${s.lastOutTime}`);
  }
}

main().finally(() => prisma.$disconnect());
