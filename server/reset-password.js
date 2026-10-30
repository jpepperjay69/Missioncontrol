// One-time break-glass recovery for a locked-out admin. Run this in the
// Render service shell (Dashboard -> mission-control-web -> Shell):
//
//   node server/reset-password.js jpepperjay@gmail.com
//
// It prints a random temporary password and stores only its bcrypt hash.
// It never prints the hash, and nobody else ever sees the password: it
// appears only in your own shell output. Sign in with it, then set your
// own password from Home -> Admin accounts -> Set password.
import crypto from 'node:crypto';
import { pool } from './db.js';
import { hashPassword } from './auth.js';

const email = (process.argv[2] || '').toLowerCase();
if (!email) {
  console.error('Usage: node server/reset-password.js <email>');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Run this in the Render service shell, not locally.');
  process.exit(1);
}

const temp = crypto.randomBytes(6).toString('hex');
try {
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
