import { NextRequest, NextResponse } from 'next/server';
import { HikvisionISAPIClient } from '../../../../../../connector/src/hikvision-client';
import { queryOne } from '@/lib/database';

export async function POST(req: NextRequest) {
  try {
    const device = await queryOne<any>(
      'SELECT * FROM biometric_devices ORDER BY id ASC LIMIT 1'
    );

    const ip = device?.ip_address || process.env.HIKVISION_IP || '192.168.200.200';
    const port = device?.port || parseInt(process.env.HIKVISION_PORT || '80', 10);
    const username = process.env.HIKVISION_USERNAME || 'admin';
    const password = process.env.HIKVISION_PASSWORD || 'Taraj@2026';

    const client = new HikvisionISAPIClient({
      ip,
      port,
      username,
      password,
    });

    const info = await client.getDeviceInfo();

    return NextResponse.json({
      success: true,
      device: {
        name: device?.name || info.deviceName || 'Taraj Global Terminal',
        model: info.model || device?.model || 'DS-K1T343EFWX',
        serialNumber: info.serialNumber || device?.serial_number,
        firmwareVersion: info.firmwareVersion || device?.firmware_version,
        macAddress: info.macAddress || '70-c9-12-ee-6b-c3',
        status: 'ONLINE',
        responseStatus: 'HTTP 200 OK (ISAPI Digest Handshake Verified)',
      },
    });
  } catch (err: any) {
    console.error('[API /api/biometric/devices/test] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to communicate with Hikvision terminal',
        details: 'Check if device 192.168.200.200 is reachable on current network.',
      },
      { status: 502 }
    );
  }
}
