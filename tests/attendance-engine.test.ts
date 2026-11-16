import {
  reconcilePunchesToIntervals,
  PunchRecord,
} from '../src/lib/attendance/interval-engine';
import {
  DEFAULT_OVERNIGHT_SHIFT,
  DEFAULT_DAY_SHIFT,
  getBusinessDateString,
  timeStringToMinutes,
} from '../src/lib/attendance/shift-calculator';
import { formatDualTime, isUsDaylightSaving } from '../src/lib/attendance/timezone';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, details?: any) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`, details ? details : '');
    testsFailed++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('   AttendX Dynamic Attendance Engine Test Suite     ');
  console.log('====================================================\n');

  // ---------------------------------------------------------------------------
  // TEST GROUP 1: Business Date Anchoring (Cross-Midnight Overnight Shift)
  // ---------------------------------------------------------------------------
  console.log('--- Group 1: Cross-Midnight Business Date Anchoring ---');
  {
    // Punch at 17:30 IST on Oct 30, 2026 (12:00 UTC)
    const eveningPunchUtc = new Date('2026-10-30T12:00:00Z');
    const bDate1 = getBusinessDateString(eveningPunchUtc, DEFAULT_OVERNIGHT_SHIFT);
    assert(bDate1 === '2026-10-30', 'Evening punch at 17:30 IST maps to business date 2026-10-30');

    // Punch at 01:30 AM IST on Oct 31, 2026 (Oct 30 20:00 UTC)
    const pastMidnightPunchUtc = new Date('2026-10-30T20:00:00Z');
    const bDate2 = getBusinessDateString(pastMidnightPunchUtc, DEFAULT_OVERNIGHT_SHIFT);
    assert(bDate2 === '2026-10-30', 'Past-midnight punch at 01:30 AM IST maps to start business date 2026-10-30');

    // Punch at 02:30 AM IST shift end on Oct 31, 2026 (Oct 30 21:00 UTC)
    const shiftEndPunchUtc = new Date('2026-10-30T21:00:00Z');
    const bDate3 = getBusinessDateString(shiftEndPunchUtc, DEFAULT_OVERNIGHT_SHIFT);
    assert(bDate3 === '2026-10-30', 'Shift end punch at 02:30 AM IST maps to business date 2026-10-30');

    // Punch at 18:00 IST on Oct 31, 2026 (Day 2 evening shift)
    const nextDayEveningUtc = new Date('2026-10-31T12:30:00Z');
    const bDate4 = getBusinessDateString(nextDayEveningUtc, DEFAULT_OVERNIGHT_SHIFT);
    assert(bDate4 === '2026-10-31', 'Next day evening shift maps to new business date 2026-10-31');
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 2: Overnight Shift Standard Reconciliation & Overtime
  // ---------------------------------------------------------------------------
  console.log('\n--- Group 2: Overnight Shift Reconciliation & Overtime ---');
  {
    // Punches: IN at 17:30 IST (12:00 UTC), OUT at 03:00 AM IST (21:30 UTC next day, 9.5 hours total)
    const punches: PunchRecord[] = [
      {
        id: BigInt(1),
        serialNo: 101,
        timeUtc: new Date('2026-10-30T12:00:00Z'),
        timeDevice: '2026-10-30 17:30:00',
      },
      {
        id: BigInt(2),
        serialNo: 102,
        timeUtc: new Date('2026-10-30T21:30:00Z'),
        timeDevice: '2026-10-31 03:00:00',
      },
    ];

    // Evaluated 5 hours after departure
    const nowUtc = new Date('2026-10-31T03:00:00Z');
    const res = reconcilePunchesToIntervals(punches, DEFAULT_OVERNIGHT_SHIFT, nowUtc);

    assert(res.currentState === 'COMPLETED', 'Session marked COMPLETED after shift end');
    assert(res.inCount === 1, 'inCount is 1');
    assert(res.outCount === 1, 'outCount is 1');
    assert(res.totalWorkingSeconds === 570 * 60, 'Total working time is 570 minutes (9.5 hours)', res.totalWorkingSeconds / 60);
    assert(res.lateMinutes === 0, 'On-time arrival: lateMinutes is 0');
    assert(res.overtimeMinutes === 30, 'Overtime is 30 minutes (570 - 540)');
    assert(res.earlyExitMinutes === 0, 'No early exit');
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 3: Intermediate Breaks Tracking
  // ---------------------------------------------------------------------------
  console.log('\n--- Group 3: Multiple Intermediate Breaks Tracking ---');
  {
    // Punches for Day Shift:
    // 1. IN: 10:00 (04:30 UTC)
    // 2. OUT: 13:00 (07:30 UTC) - Break 1 start (Lunch)
    // 3. IN: 13:45 (08:15 UTC) - Break 1 end (45 mins)
    // 4. OUT: 16:30 (11:00 UTC) - Break 2 start (Tea)
    // 5. IN: 16:45 (11:15 UTC) - Break 2 end (15 mins)
    // 6. OUT: 19:00 (13:30 UTC) - Final shift departure
    const punches: PunchRecord[] = [
      { id: BigInt(10), serialNo: 1, timeUtc: new Date('2026-10-30T04:30:00Z'), timeDevice: '2026-10-30 10:00:00' },
      { id: BigInt(11), serialNo: 2, timeUtc: new Date('2026-10-30T07:30:00Z'), timeDevice: '2026-10-30 13:00:00' },
      { id: BigInt(12), serialNo: 3, timeUtc: new Date('2026-10-30T08:15:00Z'), timeDevice: '2026-10-30 13:45:00' },
      { id: BigInt(13), serialNo: 4, timeUtc: new Date('2026-10-30T11:00:00Z'), timeDevice: '2026-10-30 16:30:00' },
      { id: BigInt(14), serialNo: 5, timeUtc: new Date('2026-10-30T11:15:00Z'), timeDevice: '2026-10-30 16:45:00' },
      { id: BigInt(15), serialNo: 6, timeUtc: new Date('2026-10-30T13:30:00Z'), timeDevice: '2026-10-30 19:00:00' },
    ];

    const nowUtc = new Date('2026-10-30T19:00:00Z');
    const res = reconcilePunchesToIntervals(punches, DEFAULT_DAY_SHIFT, nowUtc);

    assert(res.completedBreakCount === 2, '2 completed breaks recorded');
    assert(res.totalBreakSeconds === 60 * 60, 'Total break time is exactly 60 minutes (45m lunch + 15m tea)', res.totalBreakSeconds / 60);
    assert(res.totalWorkingSeconds === 480 * 60, 'Total working time is 480 minutes (8 hours work)', res.totalWorkingSeconds / 60);
    assert(res.inCount === 3, 'inCount is 3');
    assert(res.outCount === 3, 'outCount is 3');
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 4: Late Arrival & Early Exit Detection
  // ---------------------------------------------------------------------------
  console.log('\n--- Group 4: Late Arrival & Early Exit Detection ---');
  {
    // Arrived at 10:35 AM IST (05:05 UTC, 35 mins late on 10:00 start)
    // Left at 17:30 PM IST (12:00 UTC, 90 mins early on 19:00 end)
    const punches: PunchRecord[] = [
      { id: BigInt(20), serialNo: 201, timeUtc: new Date('2026-10-30T05:05:00Z'), timeDevice: '2026-10-30 10:35:00' },
      { id: BigInt(21), serialNo: 202, timeUtc: new Date('2026-10-30T12:00:00Z'), timeDevice: '2026-10-30 17:30:00' },
    ];

    const nowUtc = new Date('2026-10-30T18:00:00Z');
    const res = reconcilePunchesToIntervals(punches, DEFAULT_DAY_SHIFT, nowUtc);

    assert(res.lateMinutes === 35, 'Detected late arrival by 35 minutes');
    // Worked 10:35 to 17:30 = 415 mins. Shift duration = 540 mins. Early exit = 125 mins
    assert(res.earlyExitMinutes === 125, 'Detected early departure by 125 minutes', res.earlyExitMinutes);
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 5: Single Punch Non-Inference (Never Fabricate Fake OUT)
  // ---------------------------------------------------------------------------
  console.log('\n--- Group 5: Single Punch Policy (No Fake Out Inferred) ---');
  {
    // Employee punches IN at 17:30 IST but never punches OUT
    const punches: PunchRecord[] = [
      { id: BigInt(30), serialNo: 301, timeUtc: new Date('2026-10-30T12:00:00Z'), timeDevice: '2026-10-30 17:30:00' },
    ];

    // Evaluated next morning at 10:00 AM IST (16.5 hours later)
    const nextMorningUtc = new Date('2026-10-31T04:30:00Z');
    const res = reconcilePunchesToIntervals(punches, DEFAULT_OVERNIGHT_SHIFT, nextMorningUtc);

    assert(res.lastOutTime === null, 'lastOutTime remains null (NOT fabricated)');
    assert(res.outCount === 0, 'outCount is 0');
    assert(res.currentState === 'MISSING_OUT', 'State flagged as MISSING_OUT for audit review');
    assert(res.completionStatus === 'PENDING_CLOSURE', 'Status set to PENDING_CLOSURE');
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 6: Debounce Rapid Accidental Taps
  // ---------------------------------------------------------------------------
  console.log('\n--- Group 6: Hardware Debounce Handling ---');
  {
    const punches: PunchRecord[] = [
      { id: BigInt(40), serialNo: 401, timeUtc: new Date('2026-10-30T12:00:00Z'), timeDevice: '2026-10-30 17:30:00' },
      { id: BigInt(41), serialNo: 402, timeUtc: new Date('2026-10-30T12:00:10Z'), timeDevice: '2026-10-30 17:30:10' }, // 10s tap
      { id: BigInt(42), serialNo: 403, timeUtc: new Date('2026-10-30T12:00:20Z'), timeDevice: '2026-10-30 17:30:20' }, // 20s tap
    ];

    const res = reconcilePunchesToIntervals(punches, DEFAULT_OVERNIGHT_SHIFT, new Date('2026-10-30T12:05:00Z'));
    assert(res.inCount === 1, 'Debounced 3 rapid punches to single First IN');
    assert(res.outCount === 0, 'outCount remains 0');
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 7: Dual Timezone & Daylight Saving Time Formatting
  // ---------------------------------------------------------------------------
  console.log('\n--- Group 7: Timezone & US Eastern Dual Clock Verification ---');
  {
    // Test date during US Daylight Saving Time (e.g. July 15) -> EDT (UTC-4)
    const summerDate = new Date('2026-07-15T12:00:00Z');
    const summerTime = formatDualTime(summerDate);
    assert(summerTime?.isDst === true, 'July date detected as US Daylight Saving Time (EDT)');
    assert(summerTime?.tzAbbreviation === 'EDT', 'July timezone abbreviation is EDT');

    // Test date during US Standard Time (e.g. December 15) -> EST (UTC-5)
    const winterDate = new Date('2026-12-15T12:00:00Z');
    const winterTime = formatDualTime(winterDate);
    assert(winterTime?.isDst === false, 'December date detected as US Standard Time (EST)');
    assert(winterTime?.tzAbbreviation === 'EST', 'December timezone abbreviation is EST');
  }

  console.log('\n====================================================');
  console.log(`   Test Results: ${testsPassed} Passed, ${testsFailed} Failed`);
  console.log('====================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Test Suite Exception:', e);
  process.exit(1);
});
