import { pool } from './db.js';

const ORG_NAME = 'St Vincent DePaul of Clearwater';

/**
 * Record an in-app notification and, when email is configured, email the
 * other admins. Email is best-effort: a failure is logged, never fatal.
 */
export async function notify({ kind, message, entityType = null, entityId = null, actorName = null }) {
  await pool.query(
    'INSERT INTO notifications (kind, message, entity_type, entity_id, actor_name) VALUES ($1, $2, $3, $4, $5)',
    [kind, message, entityType, entityId, actorName],
  );
  await sendAdminEmail(`${kind}: ${message}`, message, actorName).catch((err) => {
    console.error('Admin email failed (notification still saved):', err.message);
  });
}

/**
 * Email sending hook. Configure with env vars; with none set this is a no-op
 * (notifications still work in-app). Supported providers, in order:
 *   - Resend: RESEND_API_KEY + EMAIL_FROM
 *   - SendGrid: SENDGRID_API_KEY + EMAIL_FROM
 * No keys are ever hard-coded; add them in Render's dashboard (sync: false).
 */
export async function sendAdminEmail(subject, body, actorName) {
  const resendKey = process.env.RESEND_API_KEY;
  const sendgridKey = process.env.SENDGRID_API_KEY;
  const from = process.env.EMAIL_FROM;
  if ((!resendKey && !sendgridKey) || !from) return;

  const { rows } = await pool.query('SELECT email FROM users');
  const recipients = rows.map((r) => r.email).filter((e) => e && e !== actorName);
  if (recipients.length === 0) return;

  if (resendKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: recipients, subject, text: body }),
    });
    if (!res.ok) throw new Error(`Resend returned ${res.status}`);
    return;
  }

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sendgridKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: recipients.map((email) => ({ email })) }],
      from: { email: from },
      subject,
      content: [{ type: 'text/plain', value: body }],
    }),
  });
  if (!res.ok) throw new Error(`SendGrid returned ${res.status}`);
}

export { ORG_NAME };
