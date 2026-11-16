import mysql, { Pool } from 'mysql2/promise';
import { DbConfig } from './types';

let pool: Pool | null = null;

export function parseDatabaseUrl(): DbConfig {
  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl) {
    try {
      const parsed = new URL(dbUrl);
      return {
        host: parsed.hostname || 'localhost',
        port: parsed.port ? parseInt(parsed.port, 10) : 3306,
        user: decodeURIComponent(parsed.username || 'root'),
        password: decodeURIComponent(parsed.password || ''),
        database: parsed.pathname ? parsed.pathname.replace(/^\//, '') : 'biometric_db',
      };
    } catch {
      const match = dbUrl.match(/^mysql:\/\/([^:]+)(?::([^@]*))?@([^:/]+)(?::(\d+))?\/([^?]+)/);
      if (match) {
        return {
          user: decodeURIComponent(match[1] || 'root'),
          password: decodeURIComponent(match[2] || ''),
          host: match[3] || 'localhost',
          port: match[4] ? parseInt(match[4], 10) : 3306,
          database: match[5] || 'biometric_db',
        };
      }
    }
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'biometric_db',
  };
}

export function getDbPool(): Pool {
  if (!pool) {
    const config = parseDatabaseUrl();

    pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 25,
      maxIdle: 10,
      idleTimeout: 60000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      timezone: '+00:00', // UTC normalization across the application
      dateStrings: ['DATE'], // Returns YYYY-MM-DD strings for DATE fields to prevent timezone shifts
      supportBigNumbers: true,
      bigNumberStrings: true, // Prevents precision loss on 64-bit BigInt IDs
      decimalNumbers: true,
    });
  }

  return pool;
}

export const getPool = getDbPool;

/**
 * Health check verifying database connection responsiveness
 */
export async function checkDatabaseConnection(): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const p = getDbPool();
    const [rows]: any = await p.execute('SELECT VERSION() as version, NOW() as server_time');
    return { ok: true, version: rows[0]?.version };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

/**
 * Graceful pool teardown for application termination
 */
export async function closeDatabasePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export default {
  getDbPool,
  checkDatabaseConnection,
  closeDatabasePool,
};
