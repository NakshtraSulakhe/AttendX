import { HikvisionISAPIClient } from '../connector/src/hikvision-client';
import { processIngestedEvents } from '../src/lib/attendance/event-processor';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function syncAll() {
  const client = new HikvisionISAPIClient({
    ip: process.env.HIKVISION_IP || '192.168.200.200',
    port: parseInt(process.env.HIKVISION_PORT || '80', 10),
    username: process.env.HIKVISION_USERNAME || 'admin',
    password: process.env.HIKVISION_PASSWORD || 'Taraj@2026',
    useHttps: process.env.HIKVISION_USE_HTTPS === 'true',
  });

  const pad = (n: number) => String(n).padStart(2, '0');
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const targetDate = process.argv[2] || todayStr;

  console.log(`Fetching all events for ${targetDate} from Hikvision device (192.168.200.200)...`);
  let pos = 0;
  let totalProcessed = 0;
  let totalInserted = 0;

  while (true) {
    const res = await client.searchAcsEvents({
      startTime: `${targetDate}T00:00:00+05:30`,
      endTime: `${targetDate}T23:59:59+05:30`,
      searchResultPosition: pos,
      maxResults: 30,
    });

    const page = res.InfoList || [];
    if (page.length === 0) break;

    const empEvents = page
      .filter((e) => e.employeeNoString)
      .map((e) => ({
        serialNo: e.serialNo,
        time: e.time,
        employeeNoString: e.employeeNoString,
        name: e.name,
        cardNo: e.cardNo,
        currentVerifyMode: e.currentVerifyMode,
        attendanceStatus: e.attendanceStatus,
        rawPayload: e.rawJson,
      }));

    if (empEvents.length > 0) {
      const dbResult = await processIngestedEvents(empEvents, 'poll');
      totalProcessed += empEvents.length;
      totalInserted += dbResult.insertedCount;
      console.log(
        `Batch pos ${pos}/${res.totalMatches}: Pushed ${empEvents.length} events -> inserted: ${dbResult.insertedCount}, duplicates: ${dbResult.duplicateCount}, recalculated sessions: ${dbResult.recalculatedSessions}`
      );
    } else {
      console.log(`Batch pos ${pos}/${res.totalMatches}: ${page.length} events (0 employee events)`);
    }

    pos += page.length;
    if (pos >= res.totalMatches) break;

    // Small delay between requests to keep the device responsive
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n✅ ALL DONE! Total employee events processed: ${totalProcessed}, Newly inserted into DB: ${totalInserted}`);
}

syncAll().catch((err) => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
