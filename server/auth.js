import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const SESSION_DAYS = 30;

export function hashPassword(password) {
  return bcrypt.hashSync(password, 12);
}

export function checkPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function parseCookies(req) {
  const out = {};
  const header = req.headers.cookie;
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export async function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, tokenHash, expiresAt],
  );
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader(
    'Set-Cookie',
    `mc_session=${token}; HttpOnly; Path=/; Max-Age=${SESSION_DAYS * 24 * 60 * 60}; SameSite=Lax${secure ? '; Secure' : ''}`,
  );
}

export async function destroySession(req, res) {
  const token = parseCookies(req).mc_session;
  if (token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]).catch(() => {});
  }
  res.setHeader('Set-Cookie', 'mc_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
}

/** Load the signed-in user (if any) onto req.user. */
export async function loadUser(req, _res, next) {
  req.user = null;
  const token = parseCookies(req).mc_session;
  if (token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.role FROM users u
       JOIN sessions s ON s.user_id = u.id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [tokenHash],
    ).catch(() => ({ rows: [] }));
    if (rows.length > 0) req.user = rows[0];
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in.' });
  next();
}
