import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const devices = await prisma.biometricDevice.findMany({
      include: {
        checkpoints: true,
        credentials: {
          select: { username: true, authType: true }, // Never return passwords
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ success: true, devices });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, ipAddress, port = 80, username, password, timezone = 'Asia/Kolkata', syncInterval = 10 } = body;

    if (!ipAddress || !username || !password) {
      return NextResponse.json({ error: 'IP Address, Username, and Password are required' }, { status: 400 });
    }

    // Upsert device record
    const device = await prisma.biometricDevice.upsert({
      where: { serialNumber: body.serialNumber || `DEV_${ipAddress.replace(/\./g, '_')}` },
      update: {
        name: name || 'Hikvision DS-K1T343EFWX',
        ipAddress,
        port: parseInt(port, 10),
        timezone,
        syncIntervalSeconds: parseInt(syncInterval, 10),
      },
      create: {
        name: name || 'Hikvision DS-K1T343EFWX',
        model: 'DS-K1T343EFWX',
        serialNumber: body.serialNumber || `DEV_${ipAddress.replace(/\./g, '_')}`,
        ipAddress,
        port: parseInt(port, 10),
        timezone,
        syncIntervalSeconds: parseInt(syncInterval, 10),
        status: 'OFFLINE',
      },
    });

    // Save credentials securely
    await prisma.deviceCredential.upsert({
      where: { deviceId: device.id },
      update: { username, encryptedPassword: password },
      create: { deviceId: device.id, username, encryptedPassword: password },
    });

    return NextResponse.json({ success: true, device });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
