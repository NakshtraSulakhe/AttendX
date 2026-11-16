import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const search = searchParams.get('search') || '';

    const where: any = {};
    if (search) {
      where.OR = [
        { employeeNoString: { contains: search } },
        { employee: { name: { contains: search } } },
        { employee: { employeeCode: { contains: search } } },
      ];
    }

    const events = await prisma.biometricRawEvent.findMany({
      where,
      take: limit,
      orderBy: { eventTimeUtc: 'desc' },
      include: {
        employee: {
          include: { department: true, shift: true },
        },
        device: true,
      },
    });

    const formatted = events.map((ev, index) => ({
      sequence: index + 1,
      id: ev.id.toString(),
      serialNo: ev.serialNo,
      timeUtc: ev.eventTimeUtc.toISOString(),
      timeDevice: ev.eventTimeDevice,
      timeIst: ev.eventTimeUtc.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      dateIst: ev.eventTimeUtc.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      employeeName: ev.employee?.name || `Unmapped (Bio #${ev.employeeNoString})`,
      employeeCode: ev.employee?.employeeCode || ev.employeeNoString,
      biometricNumber: ev.employeeNoString,
      department: ev.employee?.department?.name || 'General Operations',
      verifyMode: ev.verifyMode || 'face',
      attendanceStatus: ev.attendanceStatus || (ev.minorCode === 75 ? 'IN' : 'IN/OUT'),
      deviceName: ev.device?.name || 'Taraj Hikvision Entrance',
      source: ev.ingestionSource,
      isProcessed: ev.isProcessed,
    }));

    return NextResponse.json({
      success: true,
      count: formatted.length,
      events: formatted,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
