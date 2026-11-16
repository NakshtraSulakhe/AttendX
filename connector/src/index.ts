
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import dotenv from 'dotenv';
import { HikvisionISAPIClient, AcsEventRecord, AlertStreamEvent } from './hikvision-client';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

interface CheckpointData {
  lastPollTime?: string;
  lastStreamTime?: string;
  lastSyncTime: string;
  lastSerialNo: number;
  totalSynced: number;
  updatedAt: string;
}

export class BiometricConnectorService {
  private client: HikvisionISAPIClient;
  private checkpointFile: string;
  private checkpoint: CheckpointData;
  private seenEvents: Set<string> = new Set();
  private isRunning = false;
  private isPolling = false;
  private alertStreamActive = false;
  private alertStreamController?: { abort: () => void };
  private pollTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;

  private nextJsApiUrl: string;
  private apiSecret: string;
  private pollIntervalSec: number;

  constructor() {
    const ip = process.env.HIKVISION_IP || '192.168.1.64';
    const port = parseInt(process.env.HIKVISION_PORT || '80', 10);
    const username = process.env.HIKVISION_USERNAME || 'admin';
    const password = process.env.HIKVISION_PASSWORD || 'Admin12345';
    const useHttps = process.env.HIKVISION_USE_HTTPS === 'true';

    this.nextJsApiUrl = process.env.NEXTJS_API_URL || 'http://localhost:3001/api/biometric/events';
    this.apiSecret = process.env.CONNECTOR_API_SECRET || 'biometric-secure-secret-token-2026';
    this.pollIntervalSec = parseInt(process.env.POLL_INTERVAL_SECONDS || '10', 10);

    this.client = new HikvisionISAPIClient({
      ip,
      port,
      username,
      password,
      useHttps,
    });

    this.checkpointFile = path.resolve(process.cwd(), '.sync-checkpoint.json');
    this.checkpoint = this.loadCheckpoint();
  }

  private loadCheckpoint(): CheckpointData {
    try {
      if (fs.existsSync(this.checkpointFile)) {
        const raw = fs.readFileSync(this.checkpointFile, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e: any) {
      console.warn('[Checkpoint] Failed to read checkpoint, starting fresh:', e.message);
    }

    // Default to starting from 48 hours ago
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    return {
      lastSyncTime: twoDaysAgo,
      lastSerialNo: 0,
      totalSynced: 0,
      updatedAt: new Date().toISOString(),
    };
  }

  private saveCheckpoint() {
    try {
      this.checkpoint.updatedAt = new Date().toISOString();
      fs.writeFileSync(this.checkpointFile, JSON.stringify(this.checkpoint, null, 2), 'utf-8');
    } catch (e: any) {
      console.error('[Checkpoint] Error saving checkpoint:', e.message);
    }
  }

  private getEventKey(serialNo?: number, time?: string, employeeId?: string): string {
    return `${serialNo || 0}_${time || ''}_${employeeId || ''}`;
  }

  /**
   * Forward batch of events to Next.js ingestion API
   */
  private async pushEventsToBackend(events: any[], source: 'stream' | 'poll'): Promise<boolean> {
    if (events.length === 0) return true;

    try {
      const url = new URL(this.nextJsApiUrl);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const payload = JSON.stringify({
        source,
        events,
      });

      const reqOptions: any = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'x-connector-secret': this.apiSecret,
        },
        timeout: 10000,
        rejectUnauthorized: false,
      };

      return await new Promise<boolean>((resolve) => {
        const req = client.request(reqOptions, (res) => {
          let resData = '';
          res.on('data', (c) => (resData += c));
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              console.log(`[Sync] Pushed ${events.length} events to backend (HTTP ${res.statusCode})`);
              resolve(true);
            } else {
              console.warn(`[Sync] Backend rejected events (HTTP ${res.statusCode}): ${resData}`);
              resolve(false);
            }
          });
        });

        req.on('error', (err) => {
          console.warn(`[Sync] Backend connection error (${this.nextJsApiUrl}): ${err.message}`);
          resolve(false);
        });

        req.write(payload);
        req.end();
      });
    } catch (e: any) {
      console.error('[Sync] Unexpected error during push:', e.message);
      return false;
    }
  }

  /**
   * Process and forward incoming stream event
   */
  private async handleStreamEvent(event: AlertStreamEvent) {
    const key = this.getEventKey(event.serialNo, event.dateTime, event.employeeNoString);
    if (this.seenEvents.has(key)) {
      return; // Skip duplicate
    }
    this.seenEvents.add(key);

    console.log(`⚡ [STREAM EVENT] Employee: ${event.employeeNoString || 'Unknown'} (${event.name || 'N/A'}) at ${event.dateTime}`);

    const normalized = {
      serialNo: event.serialNo || Math.floor(Date.now() / 1000),
      time: event.dateTime,
      employeeNoString: event.employeeNoString,
      name: event.name,
      cardNo: event.cardNo,
      currentVerifyMode: event.currentVerifyMode,
      attendanceStatus: event.attendanceStatus,
      rawPayload: event.rawXml,
    };

    const success = await this.pushEventsToBackend([normalized], 'stream');
    if (success) {
      if (event.serialNo && event.serialNo > this.checkpoint.lastSerialNo) {
        this.checkpoint.lastSerialNo = event.serialNo;
      }
      this.checkpoint.lastStreamTime = event.dateTime;
      this.checkpoint.totalSynced++;
      this.saveCheckpoint();
    }
  }

  /**
   * Incremental Polling Engine with full pagination support
   */
  public async performIncrementalSync(): Promise<number> {
    if (this.isPolling) return 0;
    this.isPolling = true;

    try {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const tzOffset = '+05:30'; // Device timezone CST-5:30:00 (Asia/Kolkata)
      const formatHik = (d: Date) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${tzOffset}`;

      let lastTimeStr = this.checkpoint.lastPollTime || this.checkpoint.lastSyncTime;
      let startDate = new Date(lastTimeStr);
      if (isNaN(startDate.getTime())) {
        startDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
      } else {
        // At least 30-minute overlap buffer to ensure no edge-case events are missed
        startDate = new Date(startDate.getTime() - 30 * 60 * 1000);
      }

      // Proactive Shift Guarantee: If currently in evening shift (>17:00 IST),
      // ensure we query back to at least 16:30 IST today so 5:30 PM punches are never lost after a disconnect
      const istHours = (now.getUTCHours() + 5.5) % 24;
      if (istHours >= 17) {
        const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const shiftArrivalCheck = new Date(`${todayStr}T16:30:00+05:30`);
        if (startDate.getTime() > shiftArrivalCheck.getTime()) {
          startDate = shiftArrivalCheck;
        }
      }

      const startTime = formatHik(startDate);
      const endTime = formatHik(now);

      let position = 0;
      let totalMatches = 0;
      let totalPushed = 0;
      const searchId = `search_${Date.now()}`;

      do {
        const res = await this.client.searchAcsEvents({
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
          // Only process events that have an employee associated
          if (!rec.employeeNoString) continue;

          const key = this.getEventKey(rec.serialNo, rec.time, rec.employeeNoString);
          if (!this.seenEvents.has(key)) {
            this.seenEvents.add(key);
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
        }

        if (newEvents.length > 0) {
          console.log(`[Poll] Retrieved ${newEvents.length} events (batch position ${position}/${totalMatches})`);
          const pushed = await this.pushEventsToBackend(newEvents, 'poll');
          if (pushed) {
            const maxSerial = Math.max(...newEvents.map((e) => e.serialNo));
            if (maxSerial > this.checkpoint.lastSerialNo) {
              this.checkpoint.lastSerialNo = maxSerial;
            }
            this.checkpoint.totalSynced += newEvents.length;
            totalPushed += newEvents.length;
          }
        }

        position += pageList.length;
      } while (position < totalMatches);

      this.checkpoint.lastPollTime = endTime;
      this.checkpoint.lastSyncTime = endTime;
      this.saveCheckpoint();

      return totalPushed;
    } catch (e: any) {
      console.warn('[Poll] Sync error:', e.message);
      return 0;
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Start Alert Stream with automatic reconnect
   */
  private startAlertStream() {
    console.log('[AlertStream] Initiating persistent live stream connection...');

    this.alertStreamController = this.client.openAlertStream(
      (event) => {
        this.alertStreamActive = true;
        this.handleStreamEvent(event);
      },
      (err) => {
        this.alertStreamActive = false;
        if (err.message?.includes('404') || err.message?.includes('hang up') || err.message?.includes('closed')) {
          console.log('[AlertStream] Device does not support persistent alertStream. Relying on high-speed incremental polling.');
          return;
        }
        console.warn(`[AlertStream] Stream disconnected: ${err.message}`);
        this.scheduleStreamReconnect();
      },
      () => {
        this.alertStreamActive = false;
        console.log('[AlertStream] Device closed stream. Relying on continuous polling.');
      }
    );
  }

  private scheduleStreamReconnect() {
    if (!this.isRunning || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      if (this.isRunning) {
        this.startAlertStream();
      }
    }, 15000); // Reconnect attempt every 15s
  }

  /**
   * Main Start Loop
   */
  public async start() {
    this.isRunning = true;
    console.log('====================================================');
    console.log('   LOCAL BIOMETRIC CONNECTOR SERVICE STARTED       ');
    console.log(`   Target Device:  ${process.env.HIKVISION_IP || '192.168.1.64'}`);
    console.log(`   Backend API:    ${this.nextJsApiUrl}`);
    console.log(`   Poll Interval:  ${this.pollIntervalSec}s`);
    console.log(`   Last Checkpoint:${this.checkpoint.lastSyncTime} (Synced: ${this.checkpoint.totalSynced})`);
    console.log('====================================================\n');

    // 1. Initial Device Connection & Capability Check
    try {
      const devInfo = await this.client.getDeviceInfo();
      console.log(`✅ Connected to ${devInfo.model} (Firmware: ${devInfo.firmwareVersion})`);
    } catch (err: any) {
      console.warn(`⚠️ Device connectivity probe failed: ${err.message}. Operating in resilient retry mode.`);
    }

    // 2. Initial Backfill Sync
    await this.performIncrementalSync();

    // 3. Start Live Streaming
    this.startAlertStream();

    // 4. Start Polling Engine (acts as continuous fallback / reconciliation)
    this.pollTimer = setInterval(async () => {
      if (this.isRunning) {
        await this.performIncrementalSync();
      }
    }, this.pollIntervalSec * 1000);
  }

  public stop() {
    this.isRunning = false;
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.alertStreamController) this.alertStreamController.abort();
    console.log('[Connector] Stopped successfully.');
  }
}

if (require.main === module) {
  const service = new BiometricConnectorService();
  service.start().catch((e) => {
    console.error('Fatal connector service crash:', e);
    process.exit(1);
  });

  process.on('SIGINT', () => {
    service.stop();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    service.stop();
    process.exit(0);
  });
}
