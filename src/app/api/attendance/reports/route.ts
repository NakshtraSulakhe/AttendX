import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const departmentId = searchParams.get('departmentId');
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');
    const format = searchParams.get('format') || 'json';

    const where: any = {};

    if (startDate && endDate) {
      where.businessDate = {
        gte: new Date(`${startDate}T00:00:00Z`),
        lte: new Date(`${endDate}T23:59:59Z`),
      };
    } else if (startDate) {
      where.businessDate = { gte: new Date(`${startDate}T00:00:00Z`) };
    }

    if (employeeId) {
      where.employeeId = BigInt(employeeId);
    }
    if (status) {
      where.status = status;
    }
    if (departmentId) {
      where.employee = { departmentId: BigInt(departmentId) };
    }

    const sessions = await prisma.attendanceSession.findMany({
      where,
      include: {
        employee: {
          include: { department: true, shift: true },
        },
      },
      orderBy: [{ businessDate: 'desc' }, { employee: { name: 'asc' } }],
    });

    const reportData = sessions.map((s) => ({
      businessDate: s.businessDate.toISOString().split('T')[0],
      employeeName: s.employee.name,
      employeeCode: s.employee.employeeCode,
      biometricNumber: s.employee.biometricNumber,
      department: s.employee.department?.name || 'General',
      shift: s.employee.shift?.name || 'US Overnight',
      firstInTime: s.firstInTime ? s.firstInTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-',
      lastOutTime: s.lastOutTime ? s.lastOutTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-',
      totalWorkHours: (s.totalWorkMinutes / 60).toFixed(2),
      lateMinutes: s.lateMinutes,
      earlyExitMinutes: s.earlyExitMinutes,
      overtimeMinutes: s.overtimeMinutes,
      status: s.status,
      notes: s.notes || '',
    }));

    if (format === 'csv') {
      const headers = [
        'Business Date',
        'Employee Name',
        'Employee Code',
        'Biometric ID',
        'Department',
        'Shift',
        'In Time (IST)',
        'Out Time (IST)',
        'Total Work Hours',
        'Late Mins',
        'Early Exit Mins',
        'Overtime Mins',
        'Status',
        'Notes',
      ];
      const rows = reportData.map((r) => [
        r.businessDate,
        `"${r.employeeName}"`,
        r.employeeCode,
        r.biometricNumber,
        `"${r.department}"`,
        `"${r.shift}"`,
        r.firstInTime,
        r.lastOutTime,
        r.totalWorkHours,
        r.lateMinutes,
        r.earlyExitMinutes,
        r.overtimeMinutes,
        r.status,
        `"${r.notes}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="attendance-report-${startDate || 'all'}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      count: reportData.length,
      data: reportData,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
