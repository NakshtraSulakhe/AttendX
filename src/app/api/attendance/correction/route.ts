import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recalculateEmployeeSession } from '@/lib/attendance/event-processor';
import { DEFAULT_OVERNIGHT_SHIFT } from '@/lib/attendance/shift-calculator';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      employeeId,
      businessDate,
      action, // 'RESOLVE_MISSING_OUT' | 'MANUAL_IN' | 'MANUAL_OUT' | 'ADJUST_TIMES'
      punchTimeUtc,
      reason,
      requestedBy = 'HR Administrator',
    } = body;

    if (!employeeId || !businessDate || !reason) {
      return NextResponse.json(
        { error: 'employeeId, businessDate, and reason are required' },
        { status: 400 }
      );
    }

    const empId = BigInt(employeeId);
    const bDate = new Date(`${businessDate}T00:00:00Z`);

    const employee = await prisma.employee.findUnique({
      where: { id: empId },
      include: { shift: true },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const session = await prisma.attendanceSession.findUnique({
      where: {
        employeeId_businessDate: {
          employeeId: empId,
          businessDate: bDate,
        },
      },
    });

    const shift = employee.shift || DEFAULT_OVERNIGHT_SHIFT;
    const correctionTime = punchTimeUtc ? new Date(punchTimeUtc) : new Date();

    // Log the correction audit entry
    await prisma.attendanceCorrection.create({
      data: {
        sessionId: session?.id || BigInt(0),
        employeeId: empId,
        businessDate: bDate,
        previousInTime: session?.firstInTime,
        newInTime: action === 'MANUAL_IN' ? correctionTime : session?.firstInTime,
        previousOutTime: session?.lastOutTime,
        newOutTime: action === 'RESOLVE_MISSING_OUT' || action === 'MANUAL_OUT' ? correctionTime : session?.lastOutTime,
        reason: `[${action}] ${reason} (by ${requestedBy})`,
        requestedBy: BigInt(1), // Default admin user
      },
    });

    // If adding a manual punch, insert into BiometricRawEvent as an authorized manual event
    if (action === 'MANUAL_IN' || action === 'MANUAL_OUT' || action === 'RESOLVE_MISSING_OUT') {
      const serialNo = Math.floor(Date.now() % 1000000);
      const isOut = action === 'MANUAL_OUT' || action === 'RESOLVE_MISSING_OUT';

      await prisma.biometricRawEvent.create({
        data: {
          serialNo,
          eventTimeUtc: correctionTime,
          eventTimeDevice: correctionTime.toISOString().replace('T', ' ').slice(0, 19),
          employeeNoString: employee.biometricNumber,
          employeeId: employee.id,
          verifyMode: 'manual_hr_correction',
          attendanceStatus: isOut ? 'checkOut' : 'checkIn',
          ingestionSource: 'manual_correction',
          isProcessed: true,
          rawPayload: {
            reason,
            action,
            correctedBy: requestedBy,
          },
        },
      });

      // Recalculate session and intervals
      const updatedSession = await recalculateEmployeeSession(
        empId,
        businessDate,
        shift
      );

      // Mark session as manually corrected
      await prisma.attendanceSession.update({
        where: { id: updatedSession.id },
        data: {
          isManualCorrection: true,
          notes: `Manually corrected: ${reason}`,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Attendance corrected and reconciled successfully',
        session: {
          id: updatedSession.id.toString(),
          status: updatedSession.status,
          totalWorkingSeconds: updatedSession.totalWorkingSeconds,
          totalBreakSeconds: updatedSession.totalBreakSeconds,
          inCount: updatedSession.inCount,
          outCount: updatedSession.outCount,
        },
      });
    }

    return NextResponse.json({ success: true, message: 'Correction noted' });
  } catch (error: any) {
    console.error('[AttendanceCorrection] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
