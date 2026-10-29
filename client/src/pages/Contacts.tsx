import { useEffect, useState } from 'react';
import { del, get, post, put } from '../api';
import type { Contact } from '../types';

export function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [editing, setEditing] = useState<Partial<Contact> | null>(null);
  const [error, setError] = useState('');

  async function load() { setContacts(await get('/api/contacts')); }
  useEffect(() => { load().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load.')); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editing?.id) await put(`/api/contacts/${editing.id}`, editing);
      else await post('/api/contacts', editing);
      setEditing(null);
      load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Could not save.'); }
  }

  return (
    <div>
      <h2>Industry Contacts</h2>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <h3>{editing?.id ? 'Edit contact' : 'Add a contact'}</h3>
        <form onSubmit={save}>
          <div className="form-grid">
            <div><label>Name</label><input value={editing?.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required /></div>
            <div><label>Organization</label><input value={editing?.organization || ''} onChange={(e) => setEditing({ ...editing, organization: e.target.value })} /></div>
            <div><label>Role</label><input value={editing?.role || ''} onChange={(e) => setEditing({ ...editing, role: e.target.value })} /></div>
            <div><label>Category</label><input value={editing?.category || ''} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="Vendor, partner, media…" /></div>
            <div><label>Email</label><input type="email" value={editing?.email || ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
            <div><label>Phone</label><input value={editing?.phone || ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
            <div className="full"><label>Notes</label><textarea value={editing?.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={3} /></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="primary" type="submit">Save contact</button>
            {editing ? <button type="button" onClick={() => setEditing(null)}>Cancel</button> : <button type="button" onClick={() => setEditing({})}>New contact</button>}
          </div>
        </form>
      </div>
      {contacts.length === 0 && <p className="empty">No contacts yet. Add your first contact above.</p>}
      {contacts.map((c) => (
        <div className="card list-item" key={c.id}>
          <div className="row">
            <strong style={{ flex: 1 }}>{c.name}</strong>
            <button onClick={() => setEditing(c)}>Edit</button>
            <button className="danger" onClick={async () => { await del(`/api/contacts/${c.id}`); load(); }}>Remove</button>
          </div>
          <p className="muted">{[c.organization, c.role, c.category, c.email, c.phone].filter(Boolean).join(' · ')}</p>
          {c.notes && <p>{c.notes}</p>}
        </div>
      ))}
    </div>
  );
}
