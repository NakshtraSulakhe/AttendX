import { NextRequest, NextResponse } from 'next/server';
import { HikvisionISAPIClient } from '@/../connector/src/hikvision-client';
import { processIngestedEvents } from '@/lib/attendance/event-processor';
import { execute } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return await handleSync(req);
}

export async function GET(req: NextRequest) {
  return await handleSync(req);
}

async function handleSync(req: NextRequest) {
  try {
    const ip = process.env.HIKVISION_IP || '192.168.200.200';
    const port = parseInt(process.env.HIKVISION_PORT || '80', 10);
    const username = process.env.HIKVISION_USERNAME || 'admin';
    const password = process.env.HIKVISION_PASSWORD || 'Taraj@2026';
    const useHttps = process.env.HIKVISION_USE_HTTPS === 'true';

    const client = new HikvisionISAPIClient({
      ip,
      port,
      username,
      password,
      useHttps,
      timeout: 10000,
    });

    // Read checkpoint if available
    const checkpointFile = path.resolve(process.cwd(), '.sync-checkpoint.json');
    let lastSyncTimeStr = '';
    let lastSerialNo = 0;
    let totalSynced = 0;

    try {
      if (fs.existsSync(checkpointFile)) {
        const cp = JSON.parse(fs.readFileSync(checkpointFile, 'utf-8'));
        lastSyncTimeStr = cp.lastSyncTime || '';
        lastSerialNo = cp.lastSerialNo || 0;
        totalSynced = cp.totalSynced || 0;
      }
    } catch {
      // Fallback
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    const tzOffset = '+05:30';
    const formatHik = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${tzOffset}`;

    const now = new Date();
    let startDate: Date;
    if (lastSyncTimeStr) {
      const parsed = new Date(lastSyncTimeStr);
      startDate = isNaN(parsed.getTime()) ? new Date(now.getTime() - 24 * 60 * 60 * 1000) : new Date(parsed.getTime() - 30 * 60 * 1000);
    } else {
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Always cover evening shift arrival window if current time is after 17:00 IST
    const istHours = (now.getUTCHours() + 5.5) % 24;
    if (istHours >= 17) {
      const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const shiftStartArrival = new Date(`${todayStr}T16:30:00+05:30`);
      if (startDate.getTime() > shiftStartArrival.getTime()) {
        startDate = shiftStartArrival;
      }
    }

    const startTime = formatHik(startDate);
    const endTime = formatHik(now);

    let position = 0;
    let totalMatches = 0;
    let totalPushed = 0;
    let totalInserted = 0;
    let totalRecalculated = 0;
    const searchId = `manual_sync_${Date.now()}`;

    do {
      const res = await client.searchAcsEvents({
        startTime,
        endTime,
        maxResults: 30,
        searchResultPosition: position,
        searchID: searchId,
        major: 5,
        minor: 0,
      });

      totalMatches = res.totalMatches ?? 0;
      const pageList = res.InfoList || [];
      if (pageList.length === 0) break;

      const newEvents: any[] = [];
      for (const rec of pageList) {
        if (!rec.employeeNoString) continue;
        newEvents.push({
          serialNo: rec.serialNo,
          time: rec.time,
          employeeNoString: rec.employeeNoString,
          name: rec.name,
          cardNo: rec.cardNo,
          currentVerifyMode: rec.currentVerifyMode,
          attendanceStatus: rec.attendanceStatus,
          rawPayload: rec.rawJson,
        });
      }

      if (newEvents.length > 0) {
        const result = await processIngestedEvents(newEvents, 'poll');
        totalPushed += newEvents.length;
        totalInserted += result.insertedCount;
        totalRecalculated += result.recalculatedSessions;

        const maxSerial = Math.max(...newEvents.map((e) => e.serialNo));
        if (maxSerial > lastSerialNo) {
          lastSerialNo = maxSerial;
        }
      }

      position += pageList.length;
    } while (position < totalMatches);

    // Save checkpoint
    try {
      fs.writeFileSync(
        checkpointFile,
        JSON.stringify(
          {
            lastSyncTime: endTime,
            lastSerialNo,
            totalSynced: totalSynced + totalPushed,
            updatedAt: new Date().toISOString(),
          },
          null,
          2
        ),
        'utf-8'
      );
    } catch {
      // Non-critical
    }

    // Update device heartbeat
    await execute(
      `UPDATE biometric_devices
       SET last_connected_at = NOW(), last_sync_at = NOW(), status = 'ONLINE'`
    );

    return NextResponse.json({
      success: true,
      totalDeviceMatches: totalMatches,
      pushedEventsCount: totalPushed,
      insertedCount: totalInserted,
      recalculatedSessions: totalRecalculated,
      window: { startTime, endTime },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API /api/attendance/sync-now Error]', error);
    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    );
  }
}

