import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('[Seed] Seeding default shifts and device profile...');

  // 1. Overnight Shift (Default)
  const overnightShift = await prisma.shiftConfiguration.upsert({
    where: { code: 'US_OVERNIGHT_IST' },
    update: {},
    create: {
      name: 'US Operations Overnight Shift',
      code: 'US_OVERNIGHT_IST',
      isOvernight: true,
      startTimeLocal: '17:30:00',
      endTimeLocal: '02:30:00',
      timezone: 'Asia/Kolkata',
      durationMinutes: 540,
      graceLateMinutes: 15,
      graceEarlyExitMinutes: 15,
      overtimeMinMinutes: 30,
      isDefault: true,
      isActive: true,
    },
  });

  // 2. Day General Shift
  const dayShift = await prisma.shiftConfiguration.upsert({
    where: { code: 'DAY_GENERAL_IST' },
    update: {},
    create: {
      name: 'Day General Shift',
      code: 'DAY_GENERAL_IST',
      isOvernight: false,
      startTimeLocal: '10:00:00',
      endTimeLocal: '19:00:00',
      timezone: 'Asia/Kolkata',
      durationMinutes: 540,
      graceLateMinutes: 15,
      graceEarlyExitMinutes: 15,
      overtimeMinMinutes: 30,
      isDefault: false,
      isActive: true,
    },
  });

  // 3. Register Physical Biometric Machine
  const device = await prisma.biometricDevice.upsert({
    where: { serialNumber: 'DS-K1T343EFWX20241225V032100ENFV1881098' },
    update: {
      status: 'ONLINE',
      lastConnectedAt: new Date(),
    },
    create: {
      name: 'Taraj Global Solutions Terminal',
      model: 'DS-K1T343EFWX',
      serialNumber: 'DS-K1T343EFWX20241225V032100ENFV1881098',
      ipAddress: '192.168.200.200',
      port: 80,
      useHttps: false,
      timezone: 'Asia/Kolkata',
      syncIntervalSeconds: 10,
      connectionMethod: 'ISAPI_STREAM',
      status: 'ONLINE',
      firmwareVersion: 'V3.21.0 build 241225',
      lastConnectedAt: new Date(),
    },
  });

  console.log(`✅ Default shifts seeded: "${overnightShift.name}" & "${dayShift.name}"`);
  console.log(`✅ Biometric device registered: "${device.name}" (${device.ipAddress})`);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
