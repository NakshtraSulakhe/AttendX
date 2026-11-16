import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getDbPool } from './db';

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
 * Execute multiple statements sequentially in a single connection
 */
export async function executeBatch(sql: string, paramsArray: any[][]): Promise<ResultSetHeader[]> {
  const p = getDbPool();
  const conn = await p.getConnection();
  const results: ResultSetHeader[] = [];

  try {
    for (const params of paramsArray) {
      const [res] = await conn.execute<ResultSetHeader>(sql, params);
      results.push(res);
    }
    return results;
  } finally {
    conn.release();
  }
}

export default {
  query,
  queryOne,
  execute,
  executeBatch,
};
