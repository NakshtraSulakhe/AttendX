import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_OVERNIGHT_SHIFT, getBusinessDateString, getShiftWindowUtc } from '@/lib/attendance/shift-calculator';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employeeId = BigInt(params.id);
    const { searchParams } = new URL(req.url);

    const now = new Date();
    const defaultBusinessDateStr = getBusinessDateString(now, DEFAULT_OVERNIGHT_SHIFT);
    const businessDateStr = searchParams.get('date') || defaultBusinessDateStr;
    const businessDate = new Date(`${businessDateStr}T00:00:00Z`);

    // 1. Fetch employee
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { department: true, shift: true },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // 2. Fetch session for this business date
    const session = await prisma.attendanceSession.findUnique({
      where: {
        employeeId_businessDate: {
          employeeId,
          businessDate,
        },
      },
      include: {
        intervals: {
          orderBy: { startTime: 'asc' },
        },
      },
    });

    // 3. Fetch all raw punches for this shift window
    const shift = employee.shift || DEFAULT_OVERNIGHT_SHIFT;
    const { windowStart, windowEnd } = getShiftWindowUtc(businessDateStr, shift);

    const rawPunches = await prisma.biometricRawEvent.findMany({
      where: {
        employeeId,
        eventTimeUtc: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
      include: { device: true },
      orderBy: { eventTimeUtc: 'asc' },
    });

    // Map punches with calculated interval context
    const punchHistory = rawPunches.map((p, index) => {
      // Find matching interval where this event was start or end
      const matchedInterval = session?.intervals.find(
        (inv) => inv.startEventId === p.id || inv.endEventId === p.id
      );

      const isStart = matchedInterval?.startEventId === p.id;
      let punchType = 'PUNCH';
      if (matchedInterval) {
        if (matchedInterval.intervalType === 'WORK') {
          punchType = isStart ? 'IN' : 'OUT';
        } else if (matchedInterval.intervalType === 'BREAK') {
          punchType = isStart ? 'OUT' : 'IN';
        }
      }

      return {
        sequence: index + 1,
        id: p.id.toString(),
        serialNo: p.serialNo,
        timestampUtc: p.eventTimeUtc.toISOString(),
        timestampDevice: p.eventTimeDevice,
        timeIst: p.eventTimeUtc.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
        timeEst: p.eventTimeUtc.toLocaleTimeString('en-US', { timeZone: 'America/New_York' }),
        punchType,
        verifyMode: p.verifyMode || 'face',
        deviceName: p.device?.name || 'Hikvision Terminal',
        source: p.ingestionSource,
        intervalType: matchedInterval?.intervalType || 'WORK',
      };
    });

    return NextResponse.json({
      success: true,
      serverTimeUtc: now.toISOString(),
      employee: {
        id: employee.id.toString(),
        code: employee.employeeCode,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        department: employee.department?.name || 'General Operations',
        designation: employee.designation || 'Staff',
        biometricNumber: employee.biometricNumber,
        shiftName: employee.shift?.name || 'US Operations Overnight',
        shiftHours: `${employee.shift?.startTimeLocal || '17:30'} - ${employee.shift?.endTimeLocal || '02:30'} IST`,
      },
      session: session
        ? {
            id: session.id.toString(),
            businessDate: businessDateStr,
            currentState: session.status,
            completionStatus: session.completionStatus,
            firstInTime: session.firstInTime?.toISOString() || null,
            lastInTime: session.lastInTime?.toISOString() || null,
            lastOutTime: session.lastOutTime?.toISOString() || null,
            currentIntervalStart: session.currentIntervalStart?.toISOString() || null,
            inCount: session.inCount,
            outCount: session.outCount,
            completedBreakCount: session.completedBreakCount,
            totalWorkingSeconds: session.totalWorkingSeconds,
            totalBreakSeconds: session.totalBreakSeconds,
            totalElapsedSeconds: session.totalElapsedSeconds,
          }
        : null,
      intervals: (session?.intervals || []).map((inv, idx) => ({
        id: inv.id.toString(),
        sequence: idx + 1,
        type: inv.intervalType,
        startTime: inv.startTime.toISOString(),
        endTime: inv.endTime?.toISOString() || null,
        durationSeconds: inv.durationSeconds,
        status: inv.status,
      })),
      punchHistory,
    });
  } catch (error: any) {
    console.error('[API /api/attendance/employee/[id] Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
