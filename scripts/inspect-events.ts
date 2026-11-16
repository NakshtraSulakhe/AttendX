import { prisma } from '../src/lib/prisma';

async function main() {
  const events = await prisma.biometricRawEvent.findMany({
    take: 5,
    orderBy: { eventTimeUtc: 'desc' },
  });

  console.log('--- RECENT 5 RAW BIOMETRIC EVENTS ---');
  for (const e of events) {
    console.log({
      id: e.id.toString(),
      serialNo: e.serialNo,
      timeUtc: e.eventTimeUtc.toISOString(),
      timeDevice: e.eventTimeDevice,
      employeeNoString: e.employeeNoString,
      verifyMode: e.verifyMode,
      attendanceStatus: e.attendanceStatus,
      rawPayload: e.rawPayload,
    });
  }
}

main().finally(() => prisma.$disconnect());
