import fs from 'fs';
import path from 'path';
import { execute, query, getDbPool } from '../src/lib/database';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
  console.log('====================================================');
  console.log('   AttendX Native MySQL Migration Runner            ');
  console.log('====================================================\n');

  // 1. Ensure migrations tracking table exists
  await execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      migration_name VARCHAR(191) NOT NULL UNIQUE,
      applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  const appliedRows = await query<{ migration_name: string }>(
    'SELECT migration_name FROM schema_migrations ORDER BY id ASC'
  );
  const appliedSet = new Set(appliedRows.map((r) => r.migration_name));

  const migrationsDir = path.resolve(process.cwd(), 'database', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.error(`Migrations directory not found: ${migrationsDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration file(s). Applied so far: ${appliedSet.size}`);

  let newlyApplied = 0;

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  ⏭️  Skipping already applied: ${file}`);
      continue;
    }

    console.log(`  🚀 Applying migration: ${file}...`);
    const filePath = path.join(migrationsDir, file);
    const sqlContent = fs.readFileSync(filePath, 'utf-8');

    // Strip comments cleanly before splitting by semicolon
    const cleanSql = sqlContent
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//gm, '');

    const statements = cleanSql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      for (const statement of statements) {
        if (!statement || statement.length === 0) continue;
        await conn.query(statement);
      }

      await conn.query(
        'INSERT INTO schema_migrations (migration_name) VALUES (?)',
        [file]
      );

      console.log(`  ✅ Successfully applied: ${file} (${statements.length} statements)`);
      newlyApplied++;
    } catch (err: any) {
      console.error(`  ❌ Failed applying migration ${file}:`, err.message);
      throw err;
    } finally {
      conn.release();
    }
  }

  console.log(`\nMigration run complete. Newly applied: ${newlyApplied}.`);
}

main()
  .catch((err) => {
    console.error('Fatal migration error:', err);
    process.exit(1);
  })
  .finally(() => getDbPool().end());
