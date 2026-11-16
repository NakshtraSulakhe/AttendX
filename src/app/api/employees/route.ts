import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const departmentId = searchParams.get('departmentId');
    const status = searchParams.get('status');

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { employeeCode: { contains: search } },
        { biometricNumber: { contains: search } },
      ];
    }
    if (departmentId) {
      where.departmentId = BigInt(departmentId);
    }
    if (status) {
      where.status = status;
    }

    const employees = await prisma.employee.findMany({
      where,
      include: {
        department: true,
        shift: true,
        attendanceSessions: {
          take: 5,
          orderBy: { businessDate: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const departments = await prisma.department.findMany({ orderBy: { name: 'asc' } });
    const shifts = await prisma.shiftConfiguration.findMany({ orderBy: { name: 'asc' } });

    return NextResponse.json({
      success: true,
      employees: employees.map((e) => ({
        id: e.id.toString(),
        employeeCode: e.employeeCode,
        name: e.name,
        email: e.email,
        phone: e.phone,
        department: e.department?.name || 'Unassigned',
        designation: e.designation || 'Staff',
        biometricNumber: e.biometricNumber,
        status: e.status,
        shift: e.shift?.name || 'Default US Overnight',
        dateOfJoining: e.dateOfJoining.toISOString().split('T')[0],
      })),
      departments: departments.map((d) => ({ id: d.id.toString(), name: d.name, code: d.code })),
      shifts: shifts.map((s) => ({ id: s.id.toString(), name: s.name, code: s.code, isOvernight: s.isOvernight })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employeeCode, name, email, phone, departmentId, designation, biometricNumber, shiftId, dateOfJoining } = body;

    if (!employeeCode || !name || !biometricNumber) {
      return NextResponse.json({ error: 'Employee Code, Name, and Biometric Number are required' }, { status: 400 });
    }

    const employee = await prisma.employee.create({
      data: {
        employeeCode,
        name,
        email: email || null,
        phone: phone || null,
        departmentId: departmentId ? BigInt(departmentId) : null,
        designation: designation || null,
        biometricNumber,
        shiftId: shiftId ? BigInt(shiftId) : null,
        dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : new Date(),
        status: 'ACTIVE',
      },
      include: { department: true, shift: true },
    });

    return NextResponse.json({ success: true, employee });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
