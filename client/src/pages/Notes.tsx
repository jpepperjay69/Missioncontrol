import { useEffect, useState } from 'react';
import { del, fmtDate, get, post, put } from '../api';
import type { Note } from '../types';

export function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [editing, setEditing] = useState<Partial<Note> | null>(null);
  const [error, setError] = useState('');

  async function load() { setNotes(await get('/api/notes')); }
  useEffect(() => { load().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load.')); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editing?.id) await put(`/api/notes/${editing.id}`, editing);
      else await post('/api/notes', editing);
      setEditing(null);
      load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Could not save.'); }
  }

  return (
    <div>
      <h2>Notepad</h2>
      <p className="muted">Shared with every admin. Adding, editing, or removing a note notifies the other admins.</p>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <h3>{editing?.id ? 'Edit note' : 'Add a note'}</h3>
        <form onSubmit={save}>
          <div className="form-grid">
            <div className="full"><label>Title</label><input value={editing?.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} required /></div>
            <div className="full"><label>Note</label><textarea value={editing?.body || ''} onChange={(e) => setEditing({ ...editing, body: e.target.value })} rows={6} /></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="primary" type="submit">Save note</button>
            {editing ? <button type="button" onClick={() => setEditing(null)}>Cancel</button> : <button type="button" onClick={() => setEditing({})}>New note</button>}
          </div>
        </form>
      </div>
      {notes.length === 0 && <p className="empty">No notes yet. Add the first shared note above.</p>}
      {notes.map((n) => (
        <div className="card list-item" key={n.id}>
          <div className="row">
            <strong style={{ flex: 1 }}>{n.title}</strong>
            <button onClick={() => setEditing(n)}>Edit</button>
            <button className="danger" onClick={async () => { await del(`/api/notes/${n.id}`); load(); }}>Remove</button>
          </div>
          {n.body && <p style={{ whiteSpace: 'pre-wrap' }}>{n.body}</p>}
          <p className="muted">{n.author_name ? `Last updated by ${n.author_name}` : 'Last updated'}{n.updated_at ? ` on ${fmtDate(n.updated_at)}` : ''}</p>
        </div>
      ))}
    </div>
  );
}
