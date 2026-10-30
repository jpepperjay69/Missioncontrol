// Break-glass admin password reset, made short for phone keyboards.
// Run in the Render service shell (Dashboard -> mission-control-web -> Shell):
//
//   node reset.js
//
// With no argument it resets the first (oldest) admin account; pass an
// email to reset a specific one: `node reset.js someone@example.org`.
// It prints a random temporary password and stores only its bcrypt hash.
// The password appears only in your own shell output. Sign in with it,
// then set your own password from Home -> Admin accounts -> Set password.
import crypto from 'node:crypto';
import { pool } from './server/db.js';
import { hashPassword } from './server/auth.js';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Run this in the Render service shell, not locally.');
  process.exit(1);
}

let email = (process.argv[2] || '').toLowerCase();
try {
  if (!email) {
    const { rows } = await pool.query('SELECT email FROM users ORDER BY id ASC LIMIT 1');
    if (rows.length === 0) {
      console.error('No admin account exists yet.');
      process.exit(1);
    }
    email = rows[0].email;
  }
  const temp = crypto.randomBytes(6).toString('hex');
  const { rowCount } = await pool.query(
    'UPDATE users SET password_hash = $1 WHERE email = $2',
    [hashPassword(temp), email],
  );
  if (rowCount === 0) {
    console.error(`No admin account found for ${email}.`);
    process.exit(1);
  }
  console.log(`Password reset for ${email}.`);
  console.log(`Temporary password: ${temp}`);
  console.log('Sign in with it, then set your own password from Home -> Admin accounts -> Set password.');
} finally {
  await pool.end();
}
