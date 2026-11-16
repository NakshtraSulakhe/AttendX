import { prisma } from '../src/lib/prisma';

async function main() {
  const shifts = await prisma.shiftConfiguration.findMany();
  console.log('--- SHIFTS IN DB ---');
  for (const s of shifts) {
    const empCount = await prisma.employee.count({ where: { shiftId: s.id } });
    console.log({
      id: s.id.toString(),
      name: s.name,
      code: s.code,
      isOvernight: s.isOvernight,
      startTimeLocal: s.startTimeLocal,
      endTimeLocal: s.endTimeLocal,
      timezone: s.timezone,
      durationMinutes: s.durationMinutes,
      employeesCount: empCount,
      isDefault: s.isDefault,
    });
  }

  const unassigned = await prisma.employee.count({ where: { shiftId: null } });
  console.log(`Employees without shift: ${unassigned}`);
}

main().finally(() => prisma.$disconnect());

