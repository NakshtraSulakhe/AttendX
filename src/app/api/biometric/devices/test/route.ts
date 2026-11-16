import { NextRequest, NextResponse } from 'next/server';
import { HikvisionISAPIClient } from '@/../connector/src/hikvision-client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ipAddress, port = 80, username, password, useHttps = false } = body;

    if (!ipAddress || !username || !password) {
      return NextResponse.json({ error: 'IP Address, Username, and Password are required' }, { status: 400 });
    }

    const client = new HikvisionISAPIClient({
      ip: ipAddress,
      port: parseInt(port, 10),
      username,
      password,
      useHttps,
      timeout: 8000,
    });

    // 1. Probe deviceInfo
    try {
      const info = await client.getDeviceInfo();
      const timeInfo = await client.getDeviceTime().catch(() => null);

      return NextResponse.json({
        success: true,
        status: 'CONNECTED',
        model: info.model,
        firmware: info.firmwareVersion,
        serialNumber: info.serialNumber,
        macAddress: info.macAddress,
        deviceTime: timeInfo?.localTime || 'Unknown',
        timezone: timeInfo?.timeZone || 'Unknown',
      });
    } catch (err: any) {
      return NextResponse.json({
        success: false,
        status: 'FAILED',
        error: err.message,
      }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
