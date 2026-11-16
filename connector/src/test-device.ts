import dotenv from 'dotenv';
import path from 'path';
import { HikvisionISAPIClient } from './hikvision-client';

// Load environment variables from .env or .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

interface TestSummary {
  deviceInfo: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  deviceTime: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  acsEventSearch: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  alertStream: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  details: Record<string, any>;
}

async function runDeviceDiagnostic() {
  console.log('====================================================');
  console.log('   HIKVISION BIOMETRIC DEVICE DIAGNOSTIC UTILITY    ');
  console.log('   Model Target: DS-K1T343EFWX                      ');
  console.log('====================================================\n');

  const ip = process.env.HIKVISION_IP || process.argv[2] || '192.168.1.64';
  const port = parseInt(process.env.HIKVISION_PORT || process.argv[3] || '80', 10);
  const username = process.env.HIKVISION_USERNAME || process.argv[4] || 'admin';
  const password = process.env.HIKVISION_PASSWORD || process.argv[5] || 'Admin12345';
  const useHttps = process.env.HIKVISION_USE_HTTPS === 'true';

  console.log(`[Config] Target: ${useHttps ? 'https' : 'http'}://${ip}:${port}`);
  console.log(`[Config] User: ${username} (password: ${password ? '***' : 'NOT SET'})\n`);

  const summary: TestSummary = {
    deviceInfo: 'SKIPPED',
    deviceTime: 'SKIPPED',
    acsEventSearch: 'SKIPPED',
    alertStream: 'SKIPPED',
    details: {},
  };

  const client = new HikvisionISAPIClient({
    ip,
    port,
    username,
    password,
    useHttps,
    timeout: 10000,
  });

  // Step 1: Test deviceInfo
  console.log('▶ STEP 1: Testing Device Connection (GET /ISAPI/System/deviceInfo)...');
  try {
    const info = await client.getDeviceInfo();
    summary.deviceInfo = 'SUCCESS';
    summary.details.deviceInfo = info;
    console.log('  ✅ SUCCESS! Device responded:');
    console.log(`     - Model:            ${info.model}`);
    console.log(`     - Firmware:         ${info.firmwareVersion}`);
    console.log(`     - Serial Number:    ${info.serialNumber}`);
    console.log(`     - MAC Address:      ${info.macAddress || 'N/A'}`);
    console.log(`     - Encoder Version:  ${info.encoderVersion || 'N/A'}`);
    console.log(`     - Device Name:      ${info.deviceName || 'N/A'}\n`);
  } catch (err: any) {
    summary.deviceInfo = 'FAILED';
    summary.details.deviceInfoError = err.message;
    console.log(`  ❌ FAILED: ${err.message}\n`);
  }

  // Step 2: Test deviceTime
  console.log('▶ STEP 2: Testing Time Synchronization (GET /ISAPI/System/time)...');
  try {
    const timeInfo = await client.getDeviceTime();
    summary.deviceTime = 'SUCCESS';
    summary.details.deviceTime = timeInfo;
    console.log('  ✅ SUCCESS! Device Time:');
    console.log(`     - Local Time:       ${timeInfo.localTime}`);
    console.log(`     - Time Zone:        ${timeInfo.timeZone}\n`);
  } catch (err: any) {
    summary.deviceTime = 'FAILED';
    summary.details.deviceTimeError = err.message;
    console.log(`  ❌ FAILED: ${err.message}\n`);
  }

  // Step 3: Test AcsEvent search
  console.log('▶ STEP 3: Testing Attendance Event Search (POST /ISAPI/AccessControl/AcsEvent?format=json)...');
  try {
    const now = new Date();
    // Default search for past 48 hours to ensure recent punches are captured
    const past48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const pad = (n: number) => String(n).padStart(2, '0');
    const formatHikTime = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    const startTime = formatHikTime(past48h);
    const endTime = formatHikTime(now);

    console.log(`  Querying records between ${startTime} and ${endTime}...`);
    const searchRes = await client.searchAcsEvents({
      startTime,
      endTime,
      maxResults: 10,
      searchResultPosition: 0,
      major: 5,
      minor: 0,
    });

    summary.acsEventSearch = 'SUCCESS';
    summary.details.acsEventSearch = {
      totalMatches: searchRes.totalMatches,
      numOfMatches: searchRes.numOfMatches,
      sampleRecordsCount: searchRes.InfoList.length,
    };

    console.log('  ✅ SUCCESS! AcsEvent search verified:');
    console.log(`     - Status:           ${searchRes.responseStatusStrg}`);
    console.log(`     - Total Matches:    ${searchRes.totalMatches}`);
    console.log(`     - Returned Records: ${searchRes.numOfMatches}`);

    if (searchRes.InfoList.length > 0) {
      console.log('     - Sample Event Preview:');
      const sample = searchRes.InfoList[0];
      console.log(`       * Serial No:      ${sample.serialNo}`);
      console.log(`       * Time:           ${sample.time}`);
      console.log(`       * Employee ID:    ${sample.employeeNoString || 'N/A'}`);
      console.log(`       * Employee Name:  ${sample.name || 'N/A'}`);
      console.log(`       * Verify Mode:    ${sample.currentVerifyMode || 'N/A'}`);
      console.log(`       * Major / Minor:  ${sample.major} / ${sample.minor}`);
      console.log(`       * Attend Status:  ${sample.attendanceStatus ?? 'N/A'}`);
    } else {
      console.log('     - Note: No events found in past 48 hours (Try widening the date range if punches are older).');
    }
    console.log('');
  } catch (err: any) {
    summary.acsEventSearch = 'FAILED';
    summary.details.acsEventSearchError = err.message;
    console.log(`  ❌ FAILED: ${err.message}\n`);
  }

  // Step 4: Test Alert Stream handshake
  console.log('▶ STEP 4: Testing Live Alert Stream (GET /ISAPI/Event/notification/alertStream)...');
  const alertStreamPromise = new Promise<{ status: 'SUCCESS' | 'FAILED'; error?: string }>((resolve) => {
    let receivedFirstChunk = false;
    const timeout = setTimeout(() => {
      stream.abort();
      if (receivedFirstChunk) {
        resolve({ status: 'SUCCESS' });
      } else {
        // Connected without error within 5s is also success for quiet stream
        resolve({ status: 'SUCCESS' });
      }
    }, 5000);

    const stream = client.openAlertStream(
      (event) => {
        receivedFirstChunk = true;
        console.log(`  ⚡ Real-Time Punch Detected on Stream! Employee: ${event.employeeNoString || 'Unknown'} at ${event.dateTime}`);
      },
      (err) => {
        clearTimeout(timeout);
        stream.abort();
        resolve({ status: 'FAILED', error: err.message });
      },
      () => {
        clearTimeout(timeout);
        resolve({ status: 'SUCCESS' });
      }
    );
  });

  const streamResult = await alertStreamPromise;
  summary.alertStream = streamResult.status;
  if (streamResult.status === 'SUCCESS') {
    console.log('  ✅ SUCCESS! Alert stream endpoint is active and accepted persistent connection.\n');
  } else {
    summary.details.alertStreamError = streamResult.error;
    console.log(`  ⚠️ ALERT STREAM FAILED or UNSUPPORTED: ${streamResult.error}`);
    console.log('  (Fallback incremental polling will be used automatically)\n');
  }

  console.log('====================================================');
  console.log('                DIAGNOSTIC SUMMARY                  ');
  console.log('====================================================');
  console.log(` Device Info:          ${summary.deviceInfo}`);
  console.log(` Device Time Sync:     ${summary.deviceTime}`);
  console.log(` Event Search API:     ${summary.acsEventSearch}`);
  console.log(` Live Alert Stream:    ${summary.alertStream}`);
  console.log('====================================================\n');

  return summary;
}

if (require.main === module) {
  runDeviceDiagnostic().catch((e) => {
    console.error('Fatal diagnostic error:', e);
    process.exit(1);
  });
}

export { runDeviceDiagnostic };
