import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { pool, initDb, dbReady } from './db.js';
import { loadUser, requireAuth, createSession, destroySession, hashPassword, checkPassword } from './auth.js';
import { notify, ORG_NAME } from './notify.js';
import { processDueReminders } from './reminders.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '10mb' }));
app.use(loadUser);

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

/** Generic CRUD for a table. `fields` = writable columns. */
function crud(base, table, fields, { orderBy = 'id DESC' } = {}) {
  app.get(`/api/${base}`, requireAuth, ah(async (req, res) => {
    const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY ${orderBy}`);
    res.json(rows);
  }));
  app.get(`/api/${base}/:id`, requireAuth, ah(async (req, res) => {
    const { rows } = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found.' });
    res.json(rows[0]);
  }));
  app.post(`/api/${base}`, requireAuth, ah(async (req, res) => {
    const cols = fields.filter((f) => req.body[f] !== undefined);
    const vals = cols.map((f) => req.body[f] === '' ? null : req.body[f]);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      vals,
    );
    res.status(201).json(rows[0]);
  }));
  app.put(`/api/${base}/:id`, requireAuth, ah(async (req, res) => {
    const cols = fields.filter((f) => req.body[f] !== undefined);
    if (!cols.length) return res.status(400).json({ error: 'Nothing to update.' });
    const vals = cols.map((f) => req.body[f] === '' ? null : req.body[f]);
    const set = cols.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `UPDATE ${table} SET ${set}, updated_at = now() WHERE id = $${cols.length + 1} RETURNING *`,
      [...vals, req.params.id],
    ).catch(async (err) => {
      // Tables without updated_at (e.g. payroll) fall back to a plain update.
      if (err.code === '42703') {
        return pool.query(
          `UPDATE ${table} SET ${set} WHERE id = $${cols.length + 1} RETURNING *`,
          [...vals, req.params.id],
        );
      }
      throw err;
    });
    if (!rows.length) return res.status(404).json({ error: 'Not found.' });
    res.json(rows[0]);
  }));
  app.delete(`/api/${base}/:id`, requireAuth, ah(async (req, res) => {
    await pool.query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  }));
}

// ---------- Health & auth ----------
app.get('/api/health', (req, res) => res.json({ ok: true, db: dbReady }));

app.get('/api/auth/status', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users');
  res.json({ needsSetup: rows[0].n === 0, user: req.user || null });
}));

app.post('/api/auth/setup', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users');
  if (rows[0].n > 0) return res.status(400).json({ error: 'Setup is already complete.' });
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required.' });
  const created = await pool.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
    [name, email.toLowerCase(), hashPassword(password), 'admin'],
  );
  await createSession(res, created.rows[0].id);
  res.status(201).json(created.rows[0]);
}));

app.post('/api/auth/login', ah(async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [(email || '').toLowerCase()]);
  if (!rows.length || !checkPassword(password || '', rows[0].password_hash)) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  await createSession(res, rows[0].id);
  const { password_hash: _ph, ...user } = rows[0];
  res.json(user);
}));

app.post('/api/auth/logout', ah(async (req, res) => {
  await destroySession(req, res);
  res.json({ ok: true });
}));

app.get('/api/auth/me', requireAuth, (req, res) => res.json(req.user));

// ---------- Admin accounts (multiple admins) ----------
app.get('/api/users', requireAuth, ah(async (req, res) => {
  const { rows } = await pool.query('SELECT id, name, email, role, created_at FROM users ORDER BY name ASC');
  res.json(rows);
}));
app.post('/api/users', requireAuth, ah(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required.' });
  const created = await pool.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at',
    [name, email.toLowerCase(), hashPassword(password), 'admin'],
  ).catch((err) => {
    if (err.code === '23505') throw Object.assign(new Error('That email is already in use.'), { status: 400 });
    throw err;
  });
  await notify({ kind: 'Admin added', message: `New admin account: ${name}`, entityType: 'user', entityId: created.rows[0].id, actorName: req.user.name });
  res.status(201).json(created.rows[0]);
}));
app.delete('/api/users/:id', requireAuth, ah(async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'You cannot remove your own account.' });
  await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));
app.put('/api/users/:id/password', requireAuth, ah(async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'A new password is required.' });
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashPassword(password), req.params.id]);
  res.json({ ok: true });
}));

// ---------- Dashboard stats ----------
app.get('/api/stats', requireAuth, ah(async (req, res) => {
  const [[donors], [gifts], [events], [reminders], [notes]] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS n FROM donors').then((r) => r.rows[0]),
    pool.query('SELECT COUNT(*)::int AS n, COALESCE(SUM(amount), 0) AS total FROM gifts').then((r) => r.rows[0]),
    pool.query("SELECT COUNT(*)::int AS n FROM events WHERE event_date >= CURRENT_DATE").then((r) => r.rows[0]),
    pool.query('SELECT COUNT(*)::int AS n FROM reminders WHERE completed = false').then((r) => r.rows[0]),
    pool.query('SELECT COUNT(*)::int AS n FROM notifications WHERE is_read = false').then((r) => r.rows[0]),
  ]);
  res.json({ donors: donors.n, gifts: gifts.n, giftTotal: gifts.total, upcomingEvents: events.n, openReminders: reminders.n, unreadNotifications: notes.n });
}));

// ---------- Donors & gifts ----------
crud('donors', 'donors', ['name', 'email', 'phone', 'address', 'notes'], { orderBy: 'name ASC' });

app.get('/api/donors/:id/gifts', requireAuth, ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM gifts WHERE donor_id = $1 ORDER BY gift_date DESC', [req.params.id]);
  res.json(rows);
}));
app.get('/api/donors/:id/total', requireAuth, ah(async (req, res) => {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n, COALESCE(SUM(amount), 0) AS total FROM gifts WHERE donor_id = $1', [req.params.id]);
  res.json(rows[0]);
}));
crud('gifts', 'gifts', ['donor_id', 'amount', 'gift_date', 'method', 'note'], { orderBy: 'gift_date DESC' });

// ---------- Events (with change notifications) ----------
app.get('/api/events', requireAuth, ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM events ORDER BY event_date ASC NULLS LAST, id DESC');
  res.json(rows);
}));
app.get('/api/events/:id', requireAuth, ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Not found.' });
  res.json(rows[0]);
}));
app.post('/api/events', requireAuth, ah(async (req, res) => {
  const { title, event_date, location, description, status } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required.' });
  const { rows } = await pool.query(
    'INSERT INTO events (title, event_date, location, description, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [title, event_date || null, location || null, description || null, status || 'planned'],
  );
  await notify({ kind: 'Event added', message: `New event: ${title}`, entityType: 'event', entityId: rows[0].id, actorName: req.user.name });
  res.status(201).json(rows[0]);
}));
app.put('/api/events/:id', requireAuth, ah(async (req, res) => {
  const { title, event_date, location, description, status } = req.body;
  const { rows } = await pool.query(
    'UPDATE events SET title = $1, event_date = $2, location = $3, description = $4, status = $5, updated_at = now() WHERE id = $6 RETURNING *',
    [title, event_date || null, location || null, description || null, status || 'planned', req.params.id],
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found.' });
  await notify({ kind: 'Event changed', message: `Event updated: ${rows[0].title}`, entityType: 'event', entityId: rows[0].id, actorName: req.user.name });
  res.json(rows[0]);
}));
app.delete('/api/events/:id', requireAuth, ah(async (req, res) => {
  await pool.query('DELETE FROM events WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// Event notes (add/edit fire notifications, per the required spec).
app.get('/api/events/:id/notes', requireAuth, ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM event_notes WHERE event_id = $1 ORDER BY created_at DESC', [req.params.id]);
  res.json(rows);
}));
app.post('/api/events/:id/notes', requireAuth, ah(async (req, res) => {
  const { body } = req.body;
  if (!body) return res.status(400).json({ error: 'Note text is required.' });
  const { rows } = await pool.query(
    'INSERT INTO event_notes (event_id, body, author_name) VALUES ($1, $2, $3) RETURNING *',
    [req.params.id, body, req.user.name],
  );
  const ev = await pool.query('SELECT title FROM events WHERE id = $1', [req.params.id]);
  await notify({ kind: 'Event note added', message: `New note on event "${ev.rows[0]?.title || req.params.id}"`, entityType: 'event', entityId: req.params.id, actorName: req.user.name });
  res.status(201).json(rows[0]);
}));
app.put('/api/events/:eventId/notes/:noteId', requireAuth, ah(async (req, res) => {
  const { rows } = await pool.query(
    'UPDATE event_notes SET body = $1, updated_at = now() WHERE id = $2 AND event_id = $3 RETURNING *',
    [req.body.body, req.params.noteId, req.params.eventId],
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found.' });
  await notify({ kind: 'Event note edited', message: `A note was edited on event ${req.params.eventId}`, entityType: 'event', entityId: req.params.eventId, actorName: req.user.name });
  res.json(rows[0]);
}));
app.delete('/api/events/:eventId/notes/:noteId', requireAuth, ah(async (req, res) => {
  await pool.query('DELETE FROM event_notes WHERE id = $1 AND event_id = $2', [req.params.noteId, req.params.eventId]);
  res.json({ ok: true });
}));

// ---------- Reminders ----------
crud('reminders', 'reminders', ['title', 'event_id', 'due_date', 'notes', 'completed', 'notified'], { orderBy: 'due_date ASC NULLS LAST, id DESC' });

// ---------- Industry contacts (changes fire notifications) ----------
app.get('/api/contacts', requireAuth, ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM contacts ORDER BY name ASC');
  res.json(rows);
}));
app.post('/api/contacts', requireAuth, ah(async (req, res) => {
  const { name, organization, role, email, phone, category, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required.' });
  const { rows } = await pool.query(
    'INSERT INTO contacts (name, organization, role, email, phone, category, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
    [name, organization || null, role || null, email || null, phone || null, category || null, notes || null],
  );
  await notify({ kind: 'Contact added', message: `New industry contact: ${name}`, entityType: 'contact', entityId: rows[0].id, actorName: req.user.name });
  res.status(201).json(rows[0]);
}));
app.put('/api/contacts/:id', requireAuth, ah(async (req, res) => {
  const { name, organization, role, email, phone, category, notes } = req.body;
  const { rows } = await pool.query(
    'UPDATE contacts SET name = $1, organization = $2, role = $3, email = $4, phone = $5, category = $6, notes = $7, updated_at = now() WHERE id = $8 RETURNING *',
    [name, organization || null, role || null, email || null, phone || null, category || null, notes || null, req.params.id],
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found.' });
  await notify({ kind: 'Contact changed', message: `Industry contact updated: ${rows[0].name}`, entityType: 'contact', entityId: rows[0].id, actorName: req.user.name });
  res.json(rows[0]);
}));
app.delete('/api/contacts/:id', requireAuth, ah(async (req, res) => {
  const { rows } = await pool.query('DELETE FROM contacts WHERE id = $1 RETURNING name', [req.params.id]);
  if (rows.length) {
    await notify({ kind: 'Contact changed', message: `Industry contact removed: ${rows[0].name}`, entityType: 'contact', entityId: req.params.id, actorName: req.user.name });
  }
  res.json({ ok: true });
}));

// ---------- Shared notepad (changes fire notifications) ----------
app.get('/api/notes', requireAuth, ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM notes ORDER BY updated_at DESC');
  res.json(rows);
}));
app.post('/api/notes', requireAuth, ah(async (req, res) => {
  const { title, body } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required.' });
  const { rows } = await pool.query(
    'INSERT INTO notes (title, body, author_name) VALUES ($1, $2, $3) RETURNING *',
    [title, body || '', req.user.name],
  );
  await notify({ kind: 'Note added', message: `New shared note: ${title}`, entityType: 'note', entityId: rows[0].id, actorName: req.user.name });
  res.status(201).json(rows[0]);
}));
app.put('/api/notes/:id', requireAuth, ah(async (req, res) => {
  const { title, body } = req.body;
  const { rows } = await pool.query(
    'UPDATE notes SET title = $1, body = $2, author_name = $3, updated_at = now() WHERE id = $4 RETURNING *',
    [title, body || '', req.user.name, req.params.id],
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found.' });
  await notify({ kind: 'Note changed', message: `Shared note updated: ${rows[0].title}`, entityType: 'note', entityId: rows[0].id, actorName: req.user.name });
  res.json(rows[0]);
}));
app.delete('/api/notes/:id', requireAuth, ah(async (req, res) => {
  const { rows } = await pool.query('DELETE FROM notes WHERE id = $1 RETURNING title', [req.params.id]);
  if (rows.length) {
    await notify({ kind: 'Note changed', message: `Shared note removed: ${rows[0].title}`, entityType: 'note', entityId: req.params.id, actorName: req.user.name });
  }
  res.json({ ok: true });
}));

// ---------- Thank-you letters ----------
crud('letter-templates', 'letter_templates', ['name', 'subject', 'body']);

function fillTemplate(body, donor, gift) {
  return body
    .replaceAll('{{donor_name}}', donor?.name || '')
    .replaceAll('{{amount}}', gift ? Number(gift.amount).toFixed(2) : '')
    .replaceAll('{{gift_date}}', gift?.gift_date ? String(gift.gift_date).slice(0, 10) : '')
    .replaceAll('{{org_name}}', ORG_NAME);
}

app.get('/api/letters', requireAuth, ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM letters ORDER BY created_at DESC');
  res.json(rows);
}));
app.get('/api/letters/:id', requireAuth, ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM letters WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Not found.' });
  res.json(rows[0]);
}));
app.post('/api/letters', requireAuth, ah(async (req, res) => {
  const { donor_id, gift_id, template_id } = req.body;
  const [tpl, donor, gift] = await Promise.all([
    pool.query('SELECT * FROM letter_templates WHERE id = $1', [template_id]).then((r) => r.rows[0]),
    donor_id ? pool.query('SELECT * FROM donors WHERE id = $1', [donor_id]).then((r) => r.rows[0]) : Promise.resolve(null),
    gift_id ? pool.query('SELECT * FROM gifts WHERE id = $1', [gift_id]).then((r) => r.rows[0]) : Promise.resolve(null),
  ]);
  if (!tpl) return res.status(400).json({ error: 'Choose a template.' });
  const { rows } = await pool.query(
    'INSERT INTO letters (donor_id, gift_id, template_id, subject, body) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [donor_id || null, gift_id || null, template_id, tpl.subject, fillTemplate(tpl.body, donor, gift)],
  );
  res.status(201).json(rows[0]);
}));
app.delete('/api/letters/:id', requireAuth, ah(async (req, res) => {
  await pool.query('DELETE FROM letters WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ---------- Thrift Store ----------
crud('thrift-staff', 'thrift_staff', ['name', 'role', 'phone', 'email', 'hire_date', 'notes'], { orderBy: 'name ASC' });
crud('thrift-meeting-notes', 'thrift_meeting_notes', ['meeting_date', 'title', 'body'], { orderBy: 'meeting_date DESC NULLS LAST, id DESC' });
crud('thrift-payroll', 'thrift_payroll', ['staff_id', 'period_start', 'period_end', 'hours', 'rate', 'amount', 'paid', 'note'], { orderBy: 'id DESC' });
crud('thrift-truck-expenses', 'thrift_truck_expenses', ['expense_date', 'description', 'category', 'amount', 'note'], { orderBy: 'expense_date DESC NULLS LAST, id DESC' });

// ---------- Receipts (scan & file; bytes stored in Postgres) ----------
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.get('/api/receipts', requireAuth, ah(async (req, res) => {
  const { rows } = await pool.query('SELECT id, title, vendor, amount, receipt_date, note, file_name, file_type, created_at FROM receipts ORDER BY created_at DESC');
  res.json(rows);
}));
app.post('/api/receipts', requireAuth, upload.single('file'), ah(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Attach a photo or file of the receipt.' });
  const { title, vendor, amount, receipt_date, note } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO receipts (title, vendor, amount, receipt_date, note, file_name, file_type, file_data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, title, vendor, amount, receipt_date, note, file_name, file_type, created_at',
    [title || req.file.originalname, vendor || null, amount || null, receipt_date || null, note || null, req.file.originalname, req.file.mimetype, req.file.buffer],
  );
  res.status(201).json(rows[0]);
}));
app.get('/api/receipts/:id/file', requireAuth, ah(async (req, res) => {
  const { rows } = await pool.query('SELECT file_name, file_type, file_data FROM receipts WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Not found.' });
  res.setHeader('Content-Type', rows[0].file_type);
  res.setHeader('Content-Disposition', `inline; filename="${rows[0].file_name.replace(/"/g, '')}"`);
  res.send(rows[0].file_data);
}));
app.delete('/api/receipts/:id', requireAuth, ah(async (req, res) => {
  await pool.query('DELETE FROM receipts WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ---------- Sign-in sheets ----------
crud('signin-sheets', 'signin_sheets', ['title', 'event_id', 'sheet_date', 'location'], { orderBy: 'sheet_date DESC NULLS LAST, id DESC' });
app.get('/api/signin-sheets/:id/entries', requireAuth, ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM signin_entries WHERE sheet_id = $1 ORDER BY id ASC', [req.params.id]);
  res.json(rows);
}));
app.post('/api/signin-sheets/:id/entries', requireAuth, ah(async (req, res) => {
  const { name, contact, time_in } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required.' });
  const { rows } = await pool.query(
    'INSERT INTO signin_entries (sheet_id, name, contact, time_in) VALUES ($1, $2, $3, $4) RETURNING *',
    [req.params.id, name, contact || null, time_in || null],
  );
  res.status(201).json(rows[0]);
}));
app.delete('/api/signin-sheets/:sheetId/entries/:entryId', requireAuth, ah(async (req, res) => {
  await pool.query('DELETE FROM signin_entries WHERE id = $1 AND sheet_id = $2', [req.params.entryId, req.params.sheetId]);
  res.json({ ok: true });
}));

// ---------- Notifications ----------
app.get('/api/notifications', requireAuth, ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100');
  res.json(rows);
}));
app.post('/api/notifications/:id/read', requireAuth, ah(async (req, res) => {
  await pool.query('UPDATE notifications SET is_read = true WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));
app.post('/api/notifications/read-all', requireAuth, ah(async (req, res) => {
  await pool.query('UPDATE notifications SET is_read = true WHERE is_read = false');
  res.json({ ok: true });
}));

// ---------- Manual reminder check (admin) ----------
app.post('/api/admin/check-reminders', requireAuth, ah(async (req, res) => {
  const count = await processDueReminders();
  res.json({ notified: count });
}));

// ---------- Frontend (production build) ----------
const distDir = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// ---------- Errors ----------
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

initDb().then(() => {
  app.listen(PORT, () => console.log(`Mission Control listening on port ${PORT}`));
});
