import { prisma } from '../src/lib/prisma';
import { recalculateEmployeeSession } from '../src/lib/attendance/event-processor';
import { DEFAULT_OVERNIGHT_SHIFT, getBusinessDateString } from '../src/lib/attendance/shift-calculator';

async function main() {
  console.log('[RecalculateAll] Recomputing sessions and intervals for all raw punches in database...');

  const rawEvents = await prisma.biometricRawEvent.findMany({
    where: { employeeId: { not: null } },
    include: { employee: { include: { shift: true } } },
    orderBy: { eventTimeUtc: 'asc' },
  });

  console.log(`Found ${rawEvents.length} raw events with mapped employees.`);

  const pairs: Map<string, { employeeId: bigint; businessDateStr: string; shift: any }> = new Map();

  for (const ev of rawEvents) {
    if (!ev.employeeId || !ev.employee) continue;
    const shift = ev.employee.shift || DEFAULT_OVERNIGHT_SHIFT;
    const bDate = getBusinessDateString(ev.eventTimeUtc, shift);
    const key = `${ev.employeeId}_${bDate}`;
    pairs.set(key, { employeeId: ev.employeeId, businessDateStr: bDate, shift });
  }

  console.log(`Recalculating ${pairs.size} unique employee-shift sessions...`);

  let count = 0;
  for (const [, { employeeId, businessDateStr, shift }] of Array.from(pairs.entries())) {
    const session = await recalculateEmployeeSession(employeeId, businessDateStr, shift);
    count++;
    console.log(`  [${count}/${pairs.size}] Session: Emp ${session.employeeId} on ${businessDateStr} -> ${session.status} (In: ${session.inCount}, Out: ${session.outCount}, Breaks: ${session.completedBreakCount}, Work: ${session.totalWorkMinutes}m)`);
  }

  console.log('✅ All sessions and intervals successfully reconciled!');
}

main().finally(() => prisma.$disconnect());
