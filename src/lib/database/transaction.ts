import { PoolConnection } from 'mysql2/promise';
import { getDbPool } from './db';

/**
 * Execute a multi-step callback inside an atomic MySQL transaction
 * Automatically rolls back on error and guarantees connection release in finally block
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
  withTransaction,
};
