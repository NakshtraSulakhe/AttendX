import { prisma } from '../src/lib/prisma';

export async function syncEmployeesFromDeviceEvents() {
  console.log('[EmployeeSync] Synchronizing employees from verified device punch logs...');

  // Get default overnight shift
  const defaultShift = await prisma.shiftConfiguration.findFirst({
    where: { isDefault: true },
  });

  // Get distinct raw events with employeeNoString
  const rawPunches = await prisma.biometricRawEvent.findMany({
    where: {
      employeeNoString: { not: '' },
    },
    select: {
      employeeNoString: true,
      cardNo: true,
      rawPayload: true,
    },
    distinct: ['employeeNoString'],
  });

  console.log(`[EmployeeSync] Discovered ${rawPunches.length} distinct employees on machine.`);

  let createdCount = 0;
  let updatedCount = 0;

  for (const p of rawPunches) {
    const raw = (p.rawPayload as any) || {};
    const name = raw.name || `Employee #${p.employeeNoString}`;
    const cardNo = p.cardNo || raw.cardNo || null;

    const existing = await prisma.employee.findUnique({
      where: { biometricNumber: p.employeeNoString },
    });

    if (!existing) {
      const emp = await prisma.employee.create({
        data: {
          employeeCode: `EMP${p.employeeNoString.padStart(4, '0')}`,
          name: name.trim(),
          biometricNumber: p.employeeNoString,
          designation: 'Operations Staff',
          status: 'ACTIVE',
          shiftId: defaultShift?.id,
          dateOfJoining: new Date('2024-01-01'),
        },
      });
      createdCount++;
      console.log(`  ➕ Enrolled: ${emp.name} (Bio ID: ${emp.biometricNumber})`);
    } else if (existing.name.startsWith('Biometric #') || existing.name !== name.trim()) {
      await prisma.employee.update({
        where: { id: existing.id },
        data: { name: name.trim() },
      });
      updatedCount++;
    }

    // Also link any existing raw events to this employee ID
    const emp = existing || (await prisma.employee.findUnique({ where: { biometricNumber: p.employeeNoString } }));
    if (emp) {
      await prisma.biometricRawEvent.updateMany({
        where: {
          employeeNoString: p.employeeNoString,
          employeeId: null,
        },
        data: { employeeId: emp.id },
      });
    }
  }

  console.log(`[EmployeeSync] Complete! Created: ${createdCount}, Updated: ${updatedCount}`);
}

if (require.main === module) {
  syncEmployeesFromDeviceEvents()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
