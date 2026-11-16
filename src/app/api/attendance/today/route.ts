import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fromZonedTime } from 'date-fns-tz';
import { DEFAULT_OVERNIGHT_SHIFT, getBusinessDateString, getShiftWindowUtc } from '@/lib/attendance/shift-calculator';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = new Date();
    const currentBusinessDateStr = getBusinessDateString(now, DEFAULT_OVERNIGHT_SHIFT);
    const businessDate = new Date(`${currentBusinessDateStr}T00:00:00Z`);

    // 1. All Active Employees
    const allEmployees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      include: { department: true, shift: true },
      orderBy: { name: 'asc' },
    });

    // 2. Attendance Sessions for current business date
    const todaySessions = await prisma.attendanceSession.findMany({
      where: { businessDate },
      include: {
        employee: {
          include: { department: true, shift: true },
        },
        intervals: {
          orderBy: { startTime: 'asc' },
        },
      },
    });

    const sessionByEmpId = new Map<string, (typeof todaySessions)[0]>();
    for (const s of todaySessions) {
      sessionByEmpId.set(s.employeeId.toString(), s);
    }

    // 3. Today's Raw Punches (Covers the full 24h clock: from 00:00:00 IST of business date through the overnight shift window end)
    const dayStartUtc = fromZonedTime(`${currentBusinessDateStr} 00:00:00`, 'Asia/Kolkata');
    const { windowEnd } = getShiftWindowUtc(currentBusinessDateStr, DEFAULT_OVERNIGHT_SHIFT);

    const recentPunches = await prisma.biometricRawEvent.findMany({
      where: {
        eventTimeUtc: {
          gte: dayStartUtc,
          lte: windowEnd,
        },
      },
      take: 500,
      orderBy: { eventTimeUtc: 'desc' },
      include: {
        employee: {
          include: { department: true },
        },
      },
    });

    // 4. Compute Comprehensive Employee Records with Live Timer Baselines
    let workingCount = 0;
    let onBreakCount = 0;
    let completedCount = 0;
    let notCheckedInCount = 0;
    let totalInPunches = 0;
    let totalOutPunches = 0;
    let totalWorkingSecondsSum = 0;
    let totalBreakSecondsSum = 0;

    const employeeRows = allEmployees.map((emp) => {
      const session = sessionByEmpId.get(emp.id.toString());
      const state = session?.status || 'NOT_CHECKED_IN';

      if (state === 'WORKING') workingCount++;
      else if (state === 'ON_BREAK') onBreakCount++;
      else if (state === 'COMPLETED') completedCount++;
      else notCheckedInCount++;

      if (session) {
        totalInPunches += session.inCount;
        totalOutPunches += session.outCount;
        totalWorkingSecondsSum += session.totalWorkingSeconds;
        totalBreakSecondsSum += session.totalBreakSeconds;
      }

      return {
        id: emp.id.toString(),
        employeeCode: emp.employeeCode,
        name: emp.name,
        department: emp.department?.name || 'General Operations',
        designation: emp.designation || 'Staff',
        biometricNumber: emp.biometricNumber,
        shiftName: emp.shift?.name || 'US Overnight',
        // Timer Baselines
        sessionId: session?.id.toString() || null,
        currentState: state,
        completionStatus: session?.completionStatus || 'ACTIVE',
        firstInTime: session?.firstInTime?.toISOString() || null,
        lastInTime: session?.lastInTime?.toISOString() || null,
        lastOutTime: session?.lastOutTime?.toISOString() || null,
        currentIntervalStart: session?.currentIntervalStart?.toISOString() || null,
        inCount: session?.inCount || 0,
        outCount: session?.outCount || 0,
        completedBreakCount: session?.completedBreakCount || 0,
        totalWorkingSeconds: session?.totalWorkingSeconds || 0,
        totalBreakSeconds: session?.totalBreakSeconds || 0,
        totalElapsedSeconds: session?.totalElapsedSeconds || 0,
      };
    });

    // 5. Device Health & Connection Status
    const device = await prisma.biometricDevice.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    const isOnline = device?.lastConnectedAt
      ? Date.now() - new Date(device.lastConnectedAt).getTime() < 120000
      : false;

    return NextResponse.json({
      success: true,
      businessDate: currentBusinessDateStr,
      serverTimeUtc: now.toISOString(),
      currentTime: {
        ist: now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
        est: now.toLocaleTimeString('en-US', { timeZone: 'America/New_York' }),
      },
      kpis: {
        totalEmployees: allEmployees.length,
        workingCount,
        onBreakCount,
        completedCount,
        notCheckedInCount,
        todayPunchesCount: recentPunches.length,
        totalInPunches,
        totalOutPunches,
        totalWorkingHours: (totalWorkingSecondsSum / 3600).toFixed(1),
        totalBreakHours: (totalBreakSecondsSum / 3600).toFixed(1),
        deviceStatus: isOnline ? 'ONLINE' : (device?.status || 'OFFLINE'),
        deviceModel: device?.model || 'DS-K1T343EFWX',
        lastSync: device?.lastConnectedAt?.toISOString() || null,
      },
      employees: employeeRows,
      recentPunches: recentPunches.map((p) => ({
        id: p.id.toString(),
        serialNo: p.serialNo,
        timeUtc: p.eventTimeUtc.toISOString(),
        timeDevice: p.eventTimeDevice,
        employeeName: p.employee?.name || `Biometric #${p.employeeNoString}`,
        employeeCode: p.employee?.employeeCode || p.employeeNoString,
        biometricNumber: p.employeeNoString,
        department: p.employee?.department?.name || 'General Operations',
        verifyMode: p.verifyMode || 'face',
        attendanceStatus: p.attendanceStatus || 'IN',
        source: p.ingestionSource,
        isConfirmed: !!p.employee,
      })),
    });
  } catch (error: any) {
    console.error('[API /api/attendance/today Error]', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
