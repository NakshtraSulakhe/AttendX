import { DigestHttpClient } from './digest-client';

export interface DeviceConfig {
  ip: string;
  port: number;
  useHttps?: boolean;
  username: string;
  password: string;
  timeout?: number;
}

export interface HikvisionDeviceInfo {
  deviceName?: string;
  deviceID?: string;
  model: string;
  serialNumber: string;
  macAddress?: string;
  firmwareVersion: string;
  firmwareReleasedDate?: string;
  encoderVersion?: string;
  deviceType?: string;
  telecontrolID?: string;
}

export interface AcsEventRecord {
  major: number;
  minor: number;
  time: string;
  serialNo: number;
  deviceNo?: number;
  doorNo?: number;
  cardReaderNo?: number;
  cardNo?: string;
  cardType?: number;
  name?: string;
  employeeNoString?: string;
  userType?: string;
  currentVerifyMode?: string;
  attendanceStatus?: number | string;
  label?: string;
  mask?: string;
  helmet?: string;
  rawJson?: any;
}

export interface AcsSearchResult {
  responseStatusStrg: string;
  numOfMatches: number;
  totalMatches: number;
  InfoList: AcsEventRecord[];
}

export interface AlertStreamEvent {
  eventType: string;
  dateTime: string;
  employeeNoString?: string;
  name?: string;
  serialNo?: number;
  cardNo?: string;
  currentVerifyMode?: string;
  attendanceStatus?: number | string;
  rawXml?: string;
}

export class HikvisionISAPIClient {
  private client: DigestHttpClient;
  private baseUrl: string;

  constructor(private config: DeviceConfig) {
    const protocol = config.useHttps ? 'https' : 'http';
    const port = config.port || (config.useHttps ? 443 : 80);
    this.baseUrl = `${protocol}://${config.ip}:${port}`;

    this.client = new DigestHttpClient({
      username: config.username,
      password: config.password,
      timeout: config.timeout || 15000,
    });
  }

  /**
   * Helper to parse XML tag content safely without external heavy XML deps
   */
  private extractXmlTag(xml: string, tag: string): string | undefined {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : undefined;
  }

  /**
   * GET /ISAPI/System/deviceInfo
   * Supports both XML and JSON return
   */
  public async getDeviceInfo(): Promise<HikvisionDeviceInfo> {
    const url = `${this.baseUrl}/ISAPI/System/deviceInfo`;
    const res = await this.client.request(url, { method: 'GET' });

    if (res.statusCode !== 200) {
      throw new Error(`Device responded with HTTP ${res.statusCode}: ${res.data.substring(0, 300)}`);
    }

    const data = res.data;

    // Try parsing as JSON first
    try {
      const json = JSON.parse(data);
      const info = json.DeviceInfo || json;
      return {
        deviceName: info.deviceName,
        deviceID: info.deviceID,
        model: info.model || 'Unknown Model',
        serialNumber: info.serialNumber || 'Unknown Serial',
        macAddress: info.macAddress,
        firmwareVersion: info.firmwareVersion || 'Unknown',
        firmwareReleasedDate: info.firmwareReleasedDate,
        encoderVersion: info.encoderVersion,
        deviceType: info.deviceType,
      };
    } catch {
      // Parse as XML
      return {
        deviceName: this.extractXmlTag(data, 'deviceName'),
        deviceID: this.extractXmlTag(data, 'deviceID'),
        model: this.extractXmlTag(data, 'model') || 'DS-K1T343EFWX',
        serialNumber: this.extractXmlTag(data, 'serialNumber') || 'N/A',
        macAddress: this.extractXmlTag(data, 'macAddress'),
        firmwareVersion: this.extractXmlTag(data, 'firmwareVersion') || 'Unknown',
        firmwareReleasedDate: this.extractXmlTag(data, 'firmwareReleasedDate'),
        encoderVersion: this.extractXmlTag(data, 'encoderVersion'),
        deviceType: this.extractXmlTag(data, 'deviceType'),
      };
    }
  }

  /**
   * GET /ISAPI/System/time
   */
  public async getDeviceTime(): Promise<{ localTime: string; timeZone: string }> {
    const url = `${this.baseUrl}/ISAPI/System/time`;
    const res = await this.client.request(url, { method: 'GET' });

    if (res.statusCode !== 200) {
      throw new Error(`Failed to get device time: HTTP ${res.statusCode}`);
    }

    const data = res.data;
    try {
      const json = JSON.parse(data);
      const timeInfo = json.Time || json;
      return {
        localTime: timeInfo.localTime,
        timeZone: timeInfo.timeZone,
      };
    } catch {
      return {
        localTime: this.extractXmlTag(data, 'localTime') || new Date().toISOString(),
        timeZone: this.extractXmlTag(data, 'timeZone') || 'CST-8',
      };
    }
  }

  /**
   * POST /ISAPI/AccessControl/AcsEvent?format=json
   * Paginated retrieval of historical and access control events
   */
  public async searchAcsEvents(options: {
    startTime: string; // ISO format: YYYY-MM-DDTHH:MM:SS
    endTime: string;   // ISO format: YYYY-MM-DDTHH:MM:SS
    searchResultPosition?: number;
    maxResults?: number;
    searchID?: string;
    major?: number;
    minor?: number;
  }): Promise<AcsSearchResult> {
    const url = `${this.baseUrl}/ISAPI/AccessControl/AcsEvent?format=json`;

    const payload = {
      AcsEventCond: {
        searchID: options.searchID || `search_${Date.now()}`,
        searchResultPosition: options.searchResultPosition ?? 0,
        maxResults: options.maxResults ?? 30,
        major: options.major ?? 5, // 5 = Access Control Events
        minor: options.minor ?? 0, // 0 = all minors (75: face, 1: card, 22: fingerprint, etc.)
        startTime: options.startTime,
        endTime: options.endTime,
      },
    };

    const res = await this.client.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.statusCode !== 200) {
      throw new Error(`AcsEvent search failed: HTTP ${res.statusCode} - ${res.data}`);
    }

    const json = JSON.parse(res.data);
    const acs = json.AcsEvent || json;

    return {
      responseStatusStrg: acs.responseStatusStrg || 'OK',
      numOfMatches: acs.numOfMatches ?? 0,
      totalMatches: acs.totalMatches ?? 0,
      InfoList: (acs.InfoList || []).map((item: any) => ({
        major: item.major,
        minor: item.minor,
        time: item.time,
        serialNo: item.serialNo,
        deviceNo: item.deviceNo,
        doorNo: item.doorNo,
        cardReaderNo: item.cardReaderNo,
        cardNo: item.cardNo,
        cardType: item.cardType,
        name: item.name,
        employeeNoString: item.employeeNoString || (item.employeeNo ? String(item.employeeNo) : undefined),
        userType: item.userType,
        currentVerifyMode: item.currentVerifyMode,
        attendanceStatus: item.attendanceStatus,
        label: item.label,
        mask: item.mask,
        rawJson: item,
      })),
    };
  }

  /**
   * GET /ISAPI/Event/notification/alertStream
   * Opens persistent HTTP chunked stream for real-time punch events
   */
  public openAlertStream(
    onEvent: (event: AlertStreamEvent) => void,
    onError: (err: Error) => void,
    onClose: () => void
  ): { abort: () => void } {
    const url = `${this.baseUrl}/ISAPI/Event/notification/alertStream`;
    let buffer = '';

    return this.client.openStream(
      url,
      (chunk: string) => {
        buffer += chunk;

        // Hikvision streams events wrapped in <EventNotificationAlert> or <AccessControllerEvent>
        // Check for complete XML blocks
        const eventBoundaryRegex = /<AccessControllerEvent[\s\S]*?<\/AccessControllerEvent>|<EventNotificationAlert[\s\S]*?<\/EventNotificationAlert>/gi;
        let match;

        while ((match = eventBoundaryRegex.exec(buffer)) !== null) {
          const xml = match[0];
          try {
            const employeeNoString =
              this.extractXmlTag(xml, 'employeeNoString') ||
              this.extractXmlTag(xml, 'employeeNo');

            const name = this.extractXmlTag(xml, 'name');
            const dateTime = this.extractXmlTag(xml, 'dateTime') || new Date().toISOString();
            const eventType = this.extractXmlTag(xml, 'eventType') || 'accessControl';
            const serialNoStr = this.extractXmlTag(xml, 'serialNo');
            const serialNo = serialNoStr ? parseInt(serialNoStr, 10) : undefined;
            const currentVerifyMode = this.extractXmlTag(xml, 'currentVerifyMode');
            const attendanceStatus = this.extractXmlTag(xml, 'attendStatus') || this.extractXmlTag(xml, 'attendanceStatus');
            const cardNo = this.extractXmlTag(xml, 'cardNo');

            onEvent({
              eventType,
              dateTime,
              employeeNoString,
              name,
              serialNo,
              cardNo,
              currentVerifyMode,
              attendanceStatus,
              rawXml: xml,
            });
          } catch (e: any) {
            console.error('[AlertStream] Parse error for chunk:', e.message);
          }
        }

        // Keep only remainder after the last complete match to prevent memory overflow
        const lastIndex = eventBoundaryRegex.lastIndex;
        if (lastIndex > 0) {
          buffer = buffer.slice(lastIndex);
        } else if (buffer.length > 500000) {
          // Safety cutoff if no match found
          buffer = buffer.slice(-10000);
        }
      },
      onError,
      onClose
    );
  }
}
