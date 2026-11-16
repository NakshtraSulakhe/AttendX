import { query, getDbPool } from '../src/lib/db';
import { recalculateEmployeeSession } from '../src/lib/attendance/event-processor';
import { DEFAULT_OVERNIGHT_SHIFT, getBusinessDateString, ShiftInfo } from '../src/lib/attendance/shift-calculator';

async function main() {
  console.log('[RecalculateAll] Recomputing sessions and intervals for all raw punches in database...');

  const rawEvents = await query<any>(
    `SELECT r.employee_id, r.event_time_utc,
            s.id AS shift_config_id, s.name AS shift_name, s.code AS shift_code,
            s.is_overnight, s.shift_start_local, s.shift_end_local,
            s.timezone AS shift_timezone, s.duration_minutes,
            s.grace_late_minutes, s.grace_early_exit_minutes, s.overtime_min_minutes
     FROM biometric_raw_events r
     JOIN employees e ON r.employee_id = e.id
     LEFT JOIN shift_configurations s ON e.shift_id = s.id
     WHERE r.employee_id IS NOT NULL
     ORDER BY r.event_time_utc ASC`
  );

  console.log(`Found ${rawEvents.length} raw events with mapped employees.`);

  const pairs: Map<string, { employeeId: string; businessDateStr: string; shift: ShiftInfo }> = new Map();

  for (const ev of rawEvents) {
    if (!ev.employee_id) continue;

    let shift: ShiftInfo = DEFAULT_OVERNIGHT_SHIFT;
    if (ev.shift_config_id) {
      shift = {
        id: ev.shift_config_id,
        name: ev.shift_name || DEFAULT_OVERNIGHT_SHIFT.name,
        code: ev.shift_code || DEFAULT_OVERNIGHT_SHIFT.code,
        isOvernight: ev.is_overnight === 1 || ev.is_overnight === true,
        startTimeLocal: ev.shift_start_local || '17:30:00',
        endTimeLocal: ev.shift_end_local || '02:30:00',
        timezone: ev.shift_timezone || 'Asia/Kolkata',
        durationMinutes: ev.duration_minutes ?? 540,
        graceLateMinutes: ev.grace_late_minutes ?? 15,
        graceEarlyExitMinutes: ev.grace_early_exit_minutes ?? 15,
        overtimeMinMinutes: ev.overtime_min_minutes ?? 30,
      };
    }

    const eventDate = new Date(ev.event_time_utc);
    const bDate = getBusinessDateString(eventDate, shift);
    const empIdStr = ev.employee_id.toString();
    const key = `${empIdStr}_${bDate}`;
    pairs.set(key, { employeeId: empIdStr, businessDateStr: bDate, shift });
  }

  console.log(`Recalculating ${pairs.size} unique employee-shift sessions...`);

  let count = 0;
  for (const [, { employeeId, businessDateStr, shift }] of Array.from(pairs.entries())) {
    const session = await recalculateEmployeeSession(employeeId, businessDateStr, shift);
    count++;
    console.log(
      `  [${count}/${pairs.size}] Session: Emp ${session.employee_id || session.employeeId} on ${businessDateStr} -> ${session.status} (In: ${session.in_count ?? session.inCount}, Out: ${session.out_count ?? session.outCount}, Breaks: ${session.completed_break_count ?? session.completedBreakCount}, Work: ${session.total_work_minutes ?? session.totalWorkMinutes}m)`
    );
  }

  console.log('✅ All sessions and intervals successfully reconciled!');
}

main().finally(() => getDbPool().end());
