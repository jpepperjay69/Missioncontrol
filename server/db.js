import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render Postgres needs SSL; local Postgres usually does not.
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
});

export let dbReady = false;

/** Run any not-yet-applied SQL migrations, in filename order. */
export async function runMigrations() {
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const already = await pool.query(
      'SELECT 1 FROM schema_migrations WHERE filename = $1',
      [file],
    ).catch(async (err) => {
      // schema_migrations itself is created by the first migration.
      if (err.code === '42P01') return { rows: [] };
      throw err;
    });
    if (already.rows.length > 0) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    await pool.query(sql);
    await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    console.log(`Migration applied: ${file}`);
  }
  dbReady = true;
}

export async function initDb() {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is not set; API routes that need the database will fail until it is configured.');
    return;
  }
  try {
    await runMigrations();
    console.log('Database ready.');
  } catch (err) {
    console.error('Database initialization failed:', err.message);
    console.error('The server will still listen, but database routes will fail. Fix DATABASE_URL and restart.');
  }
}
