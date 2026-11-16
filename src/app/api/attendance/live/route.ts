import { NextRequest } from 'next/server';
import { sseBroadcaster } from '@/lib/realtime/sse-broadcaster';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const stream = new ReadableStream({
    start(controller) {
      // Register with central broadcaster
      sseBroadcaster.addClient(clientId, controller);

      // Send initial connection event
      const initMessage = `event: connected\ndata: ${JSON.stringify({
        clientId,
        connectedAt: new Date().toISOString(),
        message: 'Real-time attendance stream connected',
      })}\n\n`;
      controller.enqueue(new TextEncoder().encode(initMessage));

      // Periodic keep-alive heartbeat comment every 20s
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': keepalive\n\n'));
        } catch {
          clearInterval(heartbeatInterval);
          sseBroadcaster.removeClient(clientId);
        }
      }, 20000);

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        sseBroadcaster.removeClient(clientId);
      });
    },
    cancel() {
      sseBroadcaster.removeClient(clientId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // For Nginx reverse proxy
    },
  });
}
