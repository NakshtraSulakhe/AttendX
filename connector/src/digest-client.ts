import http from 'http';
import https from 'https';
import crypto from 'crypto';
import { URL } from 'url';

export interface DigestAuthOptions {
  username: string;
  password: string;
  timeout?: number;
}

export interface DigestResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  data: string;
}

interface DigestChallenge {
  realm: string;
  nonce: string;
  qop?: string;
  opaque?: string;
  algorithm?: string;
}

export class DigestHttpClient {
  private username: string;
  private password: string;
  private timeout: number;
  private nc = 0;
  private lastChallenge?: DigestChallenge;

  constructor(options: DigestAuthOptions) {
    this.username = options.username;
    this.password = options.password;
    this.timeout = options.timeout || 15000;
  }

  private parseDigestChallenge(header: string): DigestChallenge | null {
    if (!header.toLowerCase().startsWith('digest ')) {
      return null;
    }
    const params: Record<string, string> = {};
    const regex = /(\w+)=(?:"([^"]+)"|([^\s,]+))/g;
    let match;
    while ((match = regex.exec(header)) !== null) {
      const key = match[1];
      const value = match[2] !== undefined ? match[2] : match[3];
      params[key] = value;
    }

    if (!params.realm || !params.nonce) {
      return null;
    }

    return {
      realm: params.realm,
      nonce: params.nonce,
      qop: params.qop,
      opaque: params.opaque,
      algorithm: params.algorithm || 'MD5',
    };
  }

  private md5(str: string): string {
    return crypto.createHash('md5').update(str).digest('hex');
  }

  private generateAuthHeader(
    method: string,
    uri: string,
    challenge: DigestChallenge
  ): string {
    this.nc++;
    const ncString = this.nc.toString(16).padStart(8, '0');
    const cnonce = crypto.randomBytes(8).toString('hex');

    // HA1 = MD5(username:realm:password)
    const ha1 = this.md5(`${this.username}:${challenge.realm}:${this.password}`);

    // HA2 = MD5(method:digestURI)
    const ha2 = this.md5(`${method}:${uri}`);

    let response: string;
    const qop = challenge.qop ? challenge.qop.split(',')[0].trim() : undefined;

    if (qop === 'auth' || qop === 'auth-int') {
      // response = MD5(HA1:nonce:nc:cnonce:qop:HA2)
      response = this.md5(`${ha1}:${challenge.nonce}:${ncString}:${cnonce}:${qop}:${ha2}`);
    } else {
      // response = MD5(HA1:nonce:HA2)
      response = this.md5(`${ha1}:${challenge.nonce}:${ha2}`);
    }

    const parts = [
      `username="${this.username}"`,
      `realm="${challenge.realm}"`,
      `nonce="${challenge.nonce}"`,
      `uri="${uri}"`,
      `response="${response}"`,
    ];

    if (challenge.opaque) parts.push(`opaque="${challenge.opaque}"`);
    if (challenge.algorithm) parts.push(`algorithm="${challenge.algorithm}"`);
    if (qop) {
      parts.push(`qop="${qop}"`);
      parts.push(`nc=${ncString}`);
      parts.push(`cnonce="${cnonce}"`);
    }

    return `Digest ${parts.join(', ')}`;
  }

  public async request(
    targetUrl: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string | Buffer;
    } = {},
    retries = 2
  ): Promise<DigestResponse> {
    try {
      const url = new URL(targetUrl);
      const method = (options.method || 'GET').toUpperCase();
      const uri = url.pathname + url.search;

      // First attempt: if we have a cached challenge, use it; otherwise send unauthenticated to get 401
      let authHeader: string | undefined;
      if (this.lastChallenge) {
        authHeader = this.generateAuthHeader(method, uri, this.lastChallenge);
      }

      const initialRes = await this.rawRequest(url, method, options.headers, options.body, authHeader);

      if (initialRes.statusCode === 401 && initialRes.headers['www-authenticate']) {
        const challenge = this.parseDigestChallenge(initialRes.headers['www-authenticate'] as string);
        if (challenge) {
          if (!this.lastChallenge || this.lastChallenge.nonce !== challenge.nonce) {
            this.nc = 0;
          }
          this.lastChallenge = challenge;
          const retryAuthHeader = this.generateAuthHeader(method, uri, challenge);
          const retryRes = await this.rawRequest(url, method, options.headers, options.body, retryAuthHeader);
          if (retryRes.statusCode === 401) {
            // Nonce or credentials rejected, clear cached challenge so next call starts fresh
            this.lastChallenge = undefined;
            this.nc = 0;
          }
          return retryRes;
        }
      } else if (initialRes.statusCode === 401) {
        // 401 without www-authenticate header: clear cached challenge
        this.lastChallenge = undefined;
        this.nc = 0;
      }

      return initialRes;
    } catch (err: any) {
      if (retries > 0 && (err.code === 'ECONNRESET' || err.message?.includes('hang up'))) {
        await new Promise((r) => setTimeout(r, 600));
        return this.request(targetUrl, options, retries - 1);
      }
      throw err;
    }
  }

  private rawRequest(
    url: URL,
    method: string,
    extraHeaders: Record<string, string> = {},
    body?: string | Buffer,
    authHeader?: string
  ): Promise<DigestResponse> {
    return new Promise((resolve, reject) => {
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const headers: Record<string, string | number> = {
        'Accept': 'application/json, text/xml, */*',
        'User-Agent': 'HikvisionBiometricConnector/1.0',
        'Connection': 'close',
        ...extraHeaders,
      };

      if (authHeader) {
        headers['Authorization'] = authHeader;
      }

      if (body) {
        headers['Content-Length'] = Buffer.isBuffer(body)
          ? body.length
          : Buffer.byteLength(body);
      }

      const reqOptions: any = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: method,
        headers: headers,
        agent: false,
        timeout: this.timeout,
        rejectUnauthorized: false,
      };

      const req = client.request(reqOptions, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 500,
            headers: res.headers,
            data: Buffer.concat(chunks).toString('utf-8'),
          });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${this.timeout}ms`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (body) {
        req.write(body);
      }
      req.end();
    });
  }

  public openStream(
    targetUrl: string,
    onChunk: (chunk: string) => void,
    onError: (err: Error) => void,
    onClose: () => void
  ): { abort: () => void } {
    let aborted = false;
    let activeReq: http.ClientRequest | null = null;

    const startStream = async () => {
      try {
        const url = new URL(targetUrl);
        const uri = url.pathname + url.search;

        // If no cached challenge, get 401 first
        if (!this.lastChallenge) {
          const probe = await this.rawRequest(url, 'GET');
          if (probe.statusCode === 401 && probe.headers['www-authenticate']) {
            this.lastChallenge = this.parseDigestChallenge(probe.headers['www-authenticate'] as string) || undefined;
          }
        }

        if (aborted) return;

        const isHttps = url.protocol === 'https:';
        const client = isHttps ? https : http;

        const headers: Record<string, string> = {
          'Accept': 'multipart/x-mixed-replace, text/xml, */*',
          'User-Agent': 'HikvisionBiometricConnector/1.0',
        };

        if (this.lastChallenge) {
          headers['Authorization'] = this.generateAuthHeader('GET', uri, this.lastChallenge);
        }

        const reqOptions: any = {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: uri,
          method: 'GET',
          headers: headers,
          timeout: 0, // Long-lived stream
          rejectUnauthorized: false,
        };

        const req = client.request(reqOptions, (res) => {
          if (res.statusCode === 401) {
            const challenge = this.parseDigestChallenge(res.headers['www-authenticate'] as string || '');
            if (challenge && !aborted) {
              this.lastChallenge = challenge;
              // Re-run stream with new challenge
              startStream();
              return;
            }
          }

          if (res.statusCode !== 200) {
            onError(new Error(`Stream rejected with HTTP ${res.statusCode}: ${res.statusMessage}`));
            return;
          }

          res.setEncoding('utf-8');
          res.on('data', (chunk: string) => {
            if (!aborted) onChunk(chunk);
          });
          res.on('end', () => {
            if (!aborted) onClose();
          });
          res.on('error', (err) => {
            if (!aborted) onError(err);
          });
        });

        activeReq = req;
        req.on('error', (err) => {
          if (!aborted) onError(err);
        });
        req.end();
      } catch (err: any) {
        if (!aborted) onError(err);
      }
    };

    startStream();

    return {
      abort: () => {
        aborted = true;
        if (activeReq) {
          activeReq.destroy();
        }
      },
    };
  }
}
