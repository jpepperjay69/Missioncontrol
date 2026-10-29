import { pool } from './db.js';
import { notify } from './notify.js';

/**
 * Find reminders that are due (due_date today or earlier), not completed,
 * and not yet notified; create a notification for each and mark it notified.
 * Used by the Render cron job and by the manual "Check now" admin endpoint.
 * Returns the number of reminders processed.
 */
export async function processDueReminders() {
  const { rows } = await pool.query(
    `SELECT r.id, r.title, r.due_date, e.title AS event_title
     FROM reminders r LEFT JOIN events e ON e.id = r.event_id
     WHERE r.completed = false AND r.notified = false
       AND r.due_date IS NOT NULL AND r.due_date <= CURRENT_DATE
     ORDER BY r.due_date ASC`,
  );
  for (const r of rows) {
    const label = r.event_title ? `${r.title} (event: ${r.event_title})` : r.title;
    await notify({
      kind: 'Reminder due',
      message: `Reminder due: ${label}`,
      entityType: 'reminder',
      entityId: r.id,
    });
    await pool.query('UPDATE reminders SET notified = true WHERE id = $1', [r.id]);
  }
  return rows.length;
}
