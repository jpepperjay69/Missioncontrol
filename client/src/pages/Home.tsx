import { useEffect, useState } from 'react';
import { del, get, post, put } from '../api';
import type { User } from '../types';

type Stats = { donors: number; gifts: number; giftTotal: string; upcomingEvents: number; openReminders: number; unreadNotifications: number };

function AdminAccounts({ me }: { me: User }) {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    try { setUsers(await get('/api/users')); } catch { /* ignore */ }
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      await post('/api/users', { name, email, password });
      setName(''); setEmail(''); setPassword('');
      setMsg('Admin account added.');
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not add account.');
    }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>Admin accounts</h3>
      <p className="muted">Every admin signs in with their own email and password and sees the same app and notifications.</p>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}
      {users.map((u) => (
        <div className="list-item row" key={u.id}>
          <span style={{ flex: 1 }}>{u.name} — {u.email}</span>
          <button onClick={async () => {
            const pw = window.prompt(`New password for ${u.name}:`);
            if (pw) { await put(`/api/users/${u.id}/password`, { password: pw }); setMsg('Password updated.'); }
          }}>Set password</button>
          {u.id !== me.id && <button className="danger" onClick={async () => { await del(`/api/users/${u.id}`); load(); }}>Remove</button>}
        </div>
      ))}
      <form onSubmit={add}>
        <div className="form-grid">
          <div><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="full"><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        </div>
        <div className="row" style={{ marginTop: 12 }}><button className="primary" type="submit">Add admin</button></div>
      </form>
    </div>
  );
}

export function Home({ go, me }: { go: (p: string) => void; me: User }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [checked, setChecked] = useState('');

  useEffect(() => {
    get('/api/stats').then(setStats).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load.'));
  }, []);

  async function checkReminders() {
    try {
      const r = await post('/api/admin/check-reminders', {});
      setChecked(`${r.notified} due reminder(s) found and notified.`);
      const s = await get('/api/stats');
      setStats(s);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Check failed.');
    }
  }

  return (
    <div>
      <h2>Welcome to Mission Control</h2>
      <p className="muted">St Vincent DePaul of Clearwater — everything for the director's day, in one place.</p>
      {error && <div className="error">{error}</div>}
      {checked && <div className="success">{checked}</div>}
      {stats ? (
        <div className="stat-grid">
          <div className="stat"><div className="num">{stats.donors}</div><div className="lbl">Donors</div></div>
          <div className="stat"><div className="num">{stats.gifts}</div><div className="lbl">Gifts</div></div>
          <div className="stat"><div className="num">${Number(stats.giftTotal).toFixed(2)}</div><div className="lbl">Total given</div></div>
          <div className="stat"><div className="num">{stats.upcomingEvents}</div><div className="lbl">Upcoming events</div></div>
          <div className="stat"><div className="num">{stats.openReminders}</div><div className="lbl">Open reminders</div></div>
          <div className="stat"><div className="num">{stats.unreadNotifications}</div><div className="lbl">Unread notifications</div></div>
        </div>
      ) : (
        <p className="muted">Loading…</p>
      )}
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Quick actions</h3>
        <div className="row">
          <button onClick={() => go('donors')}>Add a donor</button>
          <button onClick={() => go('events')}>Add an event</button>
          <button onClick={() => go('events')}>Add a reminder</button>
          <button onClick={() => go('receipts')}>File a receipt</button>
          <button onClick={() => go('forms')}>New sign-in sheet</button>
          <button onClick={() => go('notes')}>Write a note</button>
          <button onClick={checkReminders}>Check due reminders now</button>
        </div>
        <p className="muted" style={{ marginTop: 12 }}>
          Reminders are also checked automatically every morning by the daily job on Render.
        </p>
      </div>
      <AdminAccounts me={me} />
    </div>
  );
}
