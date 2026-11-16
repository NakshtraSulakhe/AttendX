import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const corrections = await prisma.attendanceCorrection.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        employee: {
          include: { department: true },
        },
      },
    });

    const data = corrections.map((c) => ({
      id: c.id.toString(),
      employeeName: c.employee.name,
      employeeCode: c.employee.employeeCode,
      biometricNumber: c.employee.biometricNumber,
      department: c.employee.department?.name || 'General Operations',
      businessDate: c.businessDate.toISOString().split('T')[0],
      previousInTime: c.previousInTime ? c.previousInTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-',
      newInTime: c.newInTime ? c.newInTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-',
      previousOutTime: c.previousOutTime ? c.previousOutTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-',
      newOutTime: c.newOutTime ? c.newOutTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-',
      reason: c.reason,
      createdAt: c.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    }));

    return NextResponse.json({ success: true, corrections: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
