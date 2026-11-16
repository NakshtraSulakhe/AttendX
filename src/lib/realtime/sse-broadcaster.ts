type SSEClient = {
  id: string;
  controller: ReadableStreamDefaultController;
};

class SSEBroadcaster {
  private clients: Map<string, SSEClient> = new Map();

  public addClient(id: string, controller: ReadableStreamDefaultController) {
    this.clients.set(id, { id, controller });
    console.log(`[SSE] Dashboard client connected: ${id} (Active listeners: ${this.clients.size})`);
  }

  public removeClient(id: string) {
    this.clients.delete(id);
    console.log(`[SSE] Dashboard client disconnected: ${id} (Active listeners: ${this.clients.size})`);
  }

  public broadcast(event: string, data: any) {
    const enriched = { ...data, type: event, event };
    // Send both named event and default message so both onmessage and addEventListener receive it
    const payload = `event: ${event}\ndata: ${JSON.stringify(enriched)}\n\ndata: ${JSON.stringify(enriched)}\n\n`;
    const encoder = new TextEncoder();
    const encoded = encoder.encode(payload);

    for (const [id, client] of this.clients.entries()) {
      try {
        client.controller.enqueue(encoded);
      } catch (err: any) {
        console.warn(`[SSE] Error sending to client ${id}:`, err.message);
        this.clients.delete(id);
      }
    }
  }

  public getActiveCount(): number {
    return this.clients.size;
  }
}

// Global singleton across hot reloads
const globalForSSE = global as unknown as { sseBroadcaster?: SSEBroadcaster };
export const sseBroadcaster = globalForSSE.sseBroadcaster || new SSEBroadcaster();
if (process.env.NODE_ENV !== 'production') globalForSSE.sseBroadcaster = sseBroadcaster;
