import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute, withTransaction } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const devices = await query<any>(
      `SELECT d.*,
              c.username AS cred_username, c.auth_type AS cred_auth_type
       FROM biometric_devices d
       LEFT JOIN device_credentials c ON d.id = c.device_id
       ORDER BY d.updated_at DESC`
    );

    const formatted = devices.map((d) => ({
      id: d.id.toString(),
      name: d.name,
      model: d.model,
      ipAddress: d.ip_address,
      port: d.port,
      useHttps: Boolean(d.use_https),
      timezone: d.timezone,
      syncIntervalSeconds: d.sync_interval_seconds,
      connectionMethod: d.connection_method,
      status: d.status,
      serialNumber: d.serial_number,
      firmwareVersion: d.firmware_version,
      lastConnectedAt: d.last_connected_at ? new Date(d.last_connected_at).toISOString() : null,
      lastSyncAt: d.last_sync_at ? new Date(d.last_sync_at).toISOString() : null,
      credentials: d.cred_username
        ? { username: d.cred_username, authType: d.cred_auth_type }
        : null,
    }));

    return NextResponse.json({ success: true, devices: formatted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      ipAddress,
      port = 80,
      username,
      password,
      timezone = 'Asia/Kolkata',
      syncInterval = 10,
    } = body;

    if (!ipAddress || !username || !password) {
      return NextResponse.json(
        { error: 'IP Address, Username, and Password are required' },
        { status: 400 }
      );
    }

    const serialNumber =
      body.serialNumber || `DEV_${ipAddress.replace(/\./g, '_')}`;

    const device = await withTransaction(async (conn) => {
      // 1. Upsert device
      const upsertDeviceSql = `
        INSERT INTO biometric_devices (
          name, model, serial_number, ip_address, port, timezone,
          sync_interval_seconds, status, created_at, updated_at
        ) VALUES (
          ?, 'DS-K1T343EFWX', ?, ?, ?, ?,
          ?, 'OFFLINE', NOW(), NOW()
        )
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          ip_address = VALUES(ip_address),
          port = VALUES(port),
          timezone = VALUES(timezone),
          sync_interval_seconds = VALUES(sync_interval_seconds),
          updated_at = NOW()
      `;

      await conn.execute(upsertDeviceSql, [
        name || 'Hikvision DS-K1T343EFWX',
        serialNumber,
        ipAddress,
        parseInt(port, 10),
        timezone,
        parseInt(syncInterval, 10),
      ]);

      const [deviceRows]: any = await conn.execute(
        `SELECT * FROM biometric_devices WHERE serial_number = ? LIMIT 1`,
        [serialNumber]
      );

      const dev = deviceRows[0];
      const deviceId = dev.id.toString();

      // 2. Upsert credentials
      const upsertCredSql = `
        INSERT INTO device_credentials (
          device_id, username, encrypted_password, auth_type, updated_at
        ) VALUES (
          ?, ?, ?, 'DIGEST', NOW()
        )
        ON DUPLICATE KEY UPDATE
          username = VALUES(username),
          encrypted_password = VALUES(encrypted_password),
          updated_at = NOW()
      `;

      await conn.execute(upsertCredSql, [deviceId, username, password]);

      return dev;
    });

    return NextResponse.json({ success: true, device });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
