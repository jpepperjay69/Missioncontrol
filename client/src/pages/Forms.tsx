import { useEffect, useState } from 'react';
import { del, fmtDate, get, post, put } from '../api';
import type { EventItem, SigninEntry, SigninSheet } from '../types';

export function Forms() {
  const [sheets, setSheets] = useState<SigninSheet[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selected, setSelected] = useState<SigninSheet | null>(null);
  const [entries, setEntries] = useState<SigninEntry[]>([]);
  const [form, setForm] = useState<Partial<SigninSheet>>({});
  const [entryName, setEntryName] = useState('');
  const [entryContact, setEntryContact] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setSheets(await get('/api/signin-sheets'));
    setEvents(await get('/api/events'));
  }
  useEffect(() => { load().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load.')); }, []);

  async function select(s: SigninSheet) {
    setSelected(s);
    setEntries(await get(`/api/signin-sheets/${s.id}/entries`));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      const body = { ...form, event_id: form.event_id ? Number(form.event_id) : null };
      if (form.id) await put(`/api/signin-sheets/${form.id}`, body);
      else await post('/api/signin-sheets', body);
      setForm({});
      load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Could not save.'); }
  }

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    try {
      await post(`/api/signin-sheets/${selected.id}/entries`, { name: entryName, contact: entryContact, time_in: new Date().toLocaleTimeString() });
      setEntryName(''); setEntryContact('');
      select(selected);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Could not add entry.'); }
  }

  return (
    <div>
      <h2>Forms — Sign-In Sheets</h2>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <h3>{form.id ? 'Edit sign-in sheet' : 'Create a sign-in sheet'}</h3>
        <form onSubmit={save}>
          <div className="form-grid">
            <div><label>Title</label><input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div><label>Date</label><input type="date" value={fmtDate(form.sheet_date)} onChange={(e) => setForm({ ...form, sheet_date: e.target.value })} /></div>
            <div><label>Location</label><input value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div><label>Linked event (optional)</label>
              <select value={form.event_id || ''} onChange={(e) => setForm({ ...form, event_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">None</option>
                {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
              </select>
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="primary" type="submit">Save sheet</button>
            {form.id ? <button type="button" onClick={() => setForm({})}>Cancel</button> : <button type="button" onClick={() => setForm({})}>New sheet</button>}
          </div>
        </form>
      </div>

      {sheets.length === 0 && <p className="empty">No sign-in sheets yet. Create your first one above.</p>}
      {sheets.map((s) => (
        <div className="card" key={s.id}>
          <div className="row">
            <strong style={{ flex: 1 }}>{s.title}</strong>
            <span className="muted">{fmtDate(s.sheet_date)}{s.location ? ` · ${s.location}` : ''}</span>
            <button onClick={() => select(s)}>{selected?.id === s.id ? 'Hide' : 'Open'}</button>
            <button onClick={() => setForm(s)}>Edit</button>
            <button className="danger" onClick={async () => { await del(`/api/signin-sheets/${s.id}`); if (selected?.id === s.id) setSelected(null); load(); }}>Remove</button>
          </div>
          {selected?.id === s.id && (
            <div style={{ marginTop: 12 }}>
              <form onSubmit={addEntry} className="no-print">
                <div className="form-grid">
                  <div><label>Name</label><input value={entryName} onChange={(e) => setEntryName(e.target.value)} required /></div>
                  <div><label>Phone or email</label><input value={entryContact} onChange={(e) => setEntryContact(e.target.value)} /></div>
                </div>
                <div className="row" style={{ marginTop: 8 }}><button className="primary" type="submit">Sign in</button></div>
              </form>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
                <thead><tr><th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Name</th><th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Contact</th><th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Time in</th><th className="no-print" style={{ borderBottom: '1px solid #ccc' }}></th></tr></thead>
                <tbody>
                  {entries.map((en) => (
                    <tr key={en.id}>
                      <td>{en.name}</td><td>{en.contact || ''}</td><td>{en.time_in || ''}</td>
                      <td className="no-print"><button className="danger" onClick={async () => { await del(`/api/signin-sheets/${s.id}/entries/${en.id}`); select(s); }}>Remove</button></td>
                    </tr>
                  ))}
                  {entries.length === 0 && <tr><td colSpan={4} className="muted">Nobody signed in yet.</td></tr>}
                </tbody>
              </table>
              <div className="row no-print" style={{ marginTop: 12 }}><button onClick={() => window.print()}>Print this sheet</button></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
