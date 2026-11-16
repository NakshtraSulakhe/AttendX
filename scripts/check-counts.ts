import { prisma } from '../src/lib/prisma';

async function main() {
  const totalRawEvents = await prisma.biometricRawEvent.count();
  const rawEventsToday = await prisma.biometricRawEvent.count({
    where: {
      eventTimeUtc: {
        gte: new Date('2026-10-30T00:00:00Z'),
      },
    },
  });
  const rawEventsAfterNoonToday = await prisma.biometricRawEvent.count({
    where: {
      eventTimeUtc: {
        gte: new Date('2026-10-30T06:30:00Z'), // 12:00 PM IST
      },
    },
  });

  const latestEvent = await prisma.biometricRawEvent.findFirst({
    orderBy: { eventTimeUtc: 'desc' },
  });

  const totalSessions = await prisma.attendanceSession.count();
  const sessionsToday = await prisma.attendanceSession.count({
    where: {
      businessDate: new Date('2026-10-30T00:00:00Z'),
    },
  });

  console.log('Database Stats:');
  console.log(`- Total Raw Events: ${totalRawEvents}`);
  console.log(`- Raw Events on 2026-10-30 (all day): ${rawEventsToday}`);
  console.log(`- Raw Events after 12:00 PM IST today: ${rawEventsAfterNoonToday}`);
  console.log(`- Latest Raw Event in DB: Serial ${latestEvent?.serialNo}, Device Time: ${latestEvent?.eventTimeDevice}, Emp: ${latestEvent?.employeeNoString}`);
  console.log(`- Total Sessions: ${totalSessions}`);
  console.log(`- Sessions for Business Date 2026-10-30: ${sessionsToday}`);
}

main().finally(() => prisma.$disconnect());

