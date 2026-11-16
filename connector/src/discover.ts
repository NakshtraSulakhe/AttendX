import dgram from 'dgram';
import net from 'net';
import os from 'os';

/**
 * Hikvision SADP Discovery Protocol
 * Hikvision devices listen on multicast address 239.255.255.250:37020 or broadcast.
 */
export async function discoverHikvisionDevices(timeoutMs = 4000): Promise<Array<{ ip: string; port: number; model?: string; mac?: string }>> {
  console.log('[Discovery] Scanning for Hikvision biometric devices on local network...');
  const foundDevices: Map<string, { ip: string; port: number; model?: string; mac?: string }> = new Map();

  // 1. SADP Multicast Discovery
  const sadpPromise = new Promise<void>((resolve) => {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    socket.on('error', (err) => {
      console.warn('[Discovery SADP Warning]', err.message);
      try { socket.close(); } catch {}
      resolve();
    });

    socket.on('message', (msg, rinfo) => {
      const text = msg.toString('utf-8');
      const ip = rinfo.address;
      let model = 'Hikvision Device';
      let mac = '';

      const modelMatch = text.match(/<DeviceDescription>([^<]+)<\/DeviceDescription>/i) ||
                         text.match(/<DevDesc>([^<]+)<\/DevDesc>/i) ||
                         text.match(/<model>([^<]+)<\/model>/i);
      if (modelMatch) model = modelMatch[1];

      const macMatch = text.match(/<MAC>([^<]+)<\/MAC>/i) || text.match(/<macAddress>([^<]+)<\/macAddress>/i);
      if (macMatch) mac = macMatch[1];

      foundDevices.set(ip, { ip, port: rinfo.port || 80, model, mac });
      console.log(`[Discovery] Found via SADP: ${ip} (${model}) [MAC: ${mac || 'N/A'}]`);
    });

    socket.bind(0, () => {
      try {
        socket.setBroadcast(true);
        // Hikvision SADP inquiry XML packet
        const inquiryPacket =
          '<?xml version="1.0" encoding="utf-8"?>\r\n' +
          '<Probe>\r\n' +
          '<Uuid>00000000-0000-0000-0000-000000000000</Uuid>\r\n' +
          '<Types>inquiry</Types>\r\n' +
          '</Probe>';

        const buffer = Buffer.from(inquiryPacket, 'utf-8');
        socket.send(buffer, 0, buffer.length, 37020, '239.255.255.250', () => {});
        socket.send(buffer, 0, buffer.length, 37020, '255.255.255.255', () => {});
      } catch (err: any) {
        console.warn('[Discovery] SADP send error:', err.message);
      }
    });

    setTimeout(() => {
      try { socket.close(); } catch {}
      resolve();
    }, timeoutMs);
  });

  // 2. Local Subnet Quick TCP Probe on port 80 / 8000
  const interfaces = os.networkInterfaces();
  const candidateIps: string[] = [];

  for (const name of Object.keys(interfaces)) {
    for (const netInfo of interfaces[name] || []) {
      if (netInfo.family === 'IPv4' && !netInfo.internal) {
        const parts = netInfo.address.split('.');
        if (parts.length === 4) {
          const subnetPrefix = `${parts[0]}.${parts[1]}.${parts[2]}.`;
          // Probe known IPs and common offsets (e.g. 1 to 254)
          // We prioritize 192.168.1.64 (default), gateway, and active ARP targets
          candidateIps.push(`${subnetPrefix}64`);
          candidateIps.push(`${subnetPrefix}100`);
          candidateIps.push(`${subnetPrefix}200`);
          candidateIps.push('192.168.1.64');
        }
      }
    }
  }

  const probePort = (ip: string, port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const s = new net.Socket();
      s.setTimeout(400);
      s.on('connect', () => {
        s.destroy();
        resolve(true);
      });
      s.on('error', () => {
        s.destroy();
        resolve(false);
      });
      s.on('timeout', () => {
        s.destroy();
        resolve(false);
      });
      s.connect(port, ip);
    });
  };

  await Promise.all([
    sadpPromise,
    ...Array.from(new Set(candidateIps)).map(async (ip) => {
      const open = await probePort(ip, 80);
      if (open && !foundDevices.has(ip)) {
        foundDevices.set(ip, { ip, port: 80, model: 'HTTP Host (Potential Hikvision)' });
        console.log(`[Discovery] Found HTTP device at: ${ip}:80`);
      }
    }),
  ]);

  return Array.from(foundDevices.values());
}

if (require.main === module) {
  discoverHikvisionDevices().then((devices) => {
    console.log('\nScan complete. Discovered devices:', devices);
  });
}
