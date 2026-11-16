import mysql, { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

let pool: Pool | null = null;

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

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
      // Fallback regex parsing if URL object fails on non-standard schema
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
      connectionLimit: 20,
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

/**
 * Execute a SELECT query returning an array of typed rows
 */
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const p = getDbPool();
  const [rows] = await p.execute<RowDataPacket[] & T[]>(sql, params || []);
  return rows as T[];
}

/**
 * Execute a SELECT query returning a single row or null
 */
export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute an INSERT, UPDATE, or DELETE query returning the ResultSetHeader
 */
export async function execute(sql: string, params?: any[]): Promise<ResultSetHeader> {
  const p = getDbPool();
  const [result] = await p.execute<ResultSetHeader>(sql, params || []);
  return result;
}

/**
 * Run a multi-step callback inside an atomic MySQL transaction
 */
export async function withTransaction<T>(
  callback: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const p = getDbPool();
  const conn = await p.getConnection();

  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export default {
  getDbPool,
  query,
  queryOne,
  execute,
  withTransaction,
};
