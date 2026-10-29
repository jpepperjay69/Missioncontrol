// Render cron job entrypoint: process due reminders, then exit.
// Run by render.yaml's cron service once a day. DATABASE_URL comes from
// the same managed database as the web service.
import { initDb, pool } from './db.js';
import { processDueReminders } from './reminders.js';

async function main() {
  await initDb();
  const count = await processDueReminders();
  console.log(`Reminder check complete: ${count} due reminder(s) notified.`);
  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Reminder cron failed:', err);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
