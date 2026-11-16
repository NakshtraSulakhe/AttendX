import { NextRequest, NextResponse } from 'next/server';
import { processIngestedEvents } from '@/lib/attendance/event-processor';
import { execute } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    // 1. Verify connector secret
    const secret = req.headers.get('x-connector-secret');
    const expectedSecret = process.env.CONNECTOR_API_SECRET || 'biometric-secure-secret-token-2026';

    if (secret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid connector secret header' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { events, source = 'stream' } = body;

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'Invalid payload: "events" must be a non-empty array' },
        { status: 400 }
      );
    }

    const result = await processIngestedEvents(events, source);

    // Update biometric device connection heartbeat
    try {
      await execute(
        `UPDATE biometric_devices
         SET last_connected_at = NOW(), last_sync_at = NOW(), status = 'ONLINE'`
      );
    } catch {
      // Non-critical background status update
    }

    return NextResponse.json({
      success: true,
      processed: events.length,
      inserted: result.insertedCount,
      duplicates: result.duplicateCount,
      recalculatedSessions: result.recalculatedSessions,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API /api/biometric/events Error]', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
