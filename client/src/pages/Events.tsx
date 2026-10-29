import { useEffect, useState } from 'react';
import { del, fmtDate, get, post, put } from '../api';
import type { EventItem, EventNote, Reminder } from '../types';

export function Events() {
  const [tab, setTab] = useState<'events' | 'reminders'>('events');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Partial<EventItem> | null>(null);
  const [remForm, setRemForm] = useState<Partial<Reminder>>({});
  const [notesOpen, setNotesOpen] = useState<number | null>(null);
  const [notes, setNotes] = useState<EventNote[]>([]);
  const [noteBody, setNoteBody] = useState('');
  const [editingNote, setEditingNote] = useState<EventNote | null>(null);

  async function loadEvents() { setEvents(await get('/api/events')); }
  async function loadReminders() { setReminders(await get('/api/reminders')); }
  useEffect(() => { loadEvents().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load.')); loadReminders().catch(() => {}); }, []);

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editing?.id) await put(`/api/events/${editing.id}`, editing);
      else await post('/api/events', editing);
      setEditing(null);
      loadEvents();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Could not save.'); }
  }

  async function saveReminder(e: React.FormEvent) {
    e.preventDefault();
    try {
      const body = { ...remForm, event_id: remForm.event_id ? Number(remForm.event_id) : null };
      if (remForm.id) await put(`/api/reminders/${remForm.id}`, body);
      else await post('/api/reminders', body);
      setRemForm({});
      loadReminders();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Could not save.'); }
  }

  async function openNotes(eventId: number) {
    if (notesOpen === eventId) { setNotesOpen(null); return; }
    setNotesOpen(eventId);
    setNotes(await get(`/api/events/${eventId}/notes`));
  }

  async function saveNote(e: React.FormEvent) {
    e.preventDefault();
    if (!notesOpen) return;
    try {
      if (editingNote) await put(`/api/events/${notesOpen}/notes/${editingNote.id}`, { body: noteBody });
      else await post(`/api/events/${notesOpen}/notes`, { body: noteBody });
      setNoteBody('');
      setEditingNote(null);
      setNotes(await get(`/api/events/${notesOpen}/notes`));
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Could not save note.'); }
  }

  return (
    <div>
      <h2>Events &amp; Reminders</h2>
      {error && <div className="error">{error}</div>}
      <div className="tabs">
        <button className={tab === 'events' ? 'active' : ''} onClick={() => setTab('events')}>Events</button>
        <button className={tab === 'reminders' ? 'active' : ''} onClick={() => setTab('reminders')}>Reminders</button>
      </div>

      {tab === 'events' && (
        <>
          <div className="card">
            <h3>{editing?.id ? 'Edit event' : 'Add an event'}</h3>
            <form onSubmit={saveEvent}>
              <div className="form-grid">
                <div><label>Title</label><input value={editing?.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} required /></div>
                <div><label>Date</label><input type="date" value={fmtDate(editing?.event_date)} onChange={(e) => setEditing({ ...editing, event_date: e.target.value })} /></div>
                <div><label>Location</label><input value={editing?.location || ''} onChange={(e) => setEditing({ ...editing, location: e.target.value })} /></div>
                <div><label>Status</label>
                  <select value={editing?.status || 'planned'} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                    <option value="planned">Planned</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="full"><label>Description</label><textarea value={editing?.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} /></div>
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <button className="primary" type="submit">Save event</button>
                {editing ? <button type="button" onClick={() => setEditing(null)}>Cancel</button> : <button type="button" onClick={() => setEditing({})}>New event</button>}
              </div>
            </form>
          </div>
          {events.length === 0 && <p className="empty">No events yet. Add your first event above.</p>}
          {events.map((ev) => (
            <div className="card" key={ev.id}>
              <div className="row">
                <strong style={{ flex: 1 }}>{ev.title}</strong>
                <span className="muted">{fmtDate(ev.event_date)}{ev.location ? ` · ${ev.location}` : ''} · {ev.status}</span>
              </div>
              {ev.description && <p>{ev.description}</p>}
              <div className="row">
                <button onClick={() => setEditing(ev)}>Edit</button>
                <button onClick={() => openNotes(ev.id)}>{notesOpen === ev.id ? 'Hide notes' : 'Notes'}</button>
                <button className="danger" onClick={async () => { if (window.confirm(`Remove ${ev.title}?`)) { await del(`/api/events/${ev.id}`); loadEvents(); } }}>Remove</button>
              </div>
              {notesOpen === ev.id && (
                <div style={{ marginTop: 12 }}>
                  <form onSubmit={saveNote}>
                    <label>{editingNote ? 'Edit note' : 'Add a note'}</label>
                    <textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} rows={3} required />
                    <div className="row" style={{ marginTop: 8 }}>
                      <button className="primary" type="submit">Save note</button>
                      {editingNote && <button type="button" onClick={() => { setEditingNote(null); setNoteBody(''); }}>Cancel</button>}
                    </div>
                  </form>
                  {notes.map((n) => (
                    <div className="list-item" key={n.id}>
                      <p style={{ whiteSpace: 'pre-wrap' }}>{n.body}</p>
                      <p className="muted">{n.author_name || ''} · {new Date(n.created_at).toLocaleString()}</p>
                      <div className="row">
                        <button onClick={() => { setEditingNote(n); setNoteBody(n.body); }}>Edit</button>
                        <button className="danger" onClick={async () => { await del(`/api/events/${ev.id}/notes/${n.id}`); setNotes(await get(`/api/events/${ev.id}/notes`)); }}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {tab === 'reminders' && (
        <>
          <div className="card">
            <h3>{remForm.id ? 'Edit reminder' : 'Add a reminder'}</h3>
            <form onSubmit={saveReminder}>
              <div className="form-grid">
                <div><label>Reminder</label><input value={remForm.title || ''} onChange={(e) => setRemForm({ ...remForm, title: e.target.value })} required /></div>
                <div><label>Due date</label><input type="date" value={fmtDate(remForm.due_date)} onChange={(e) => setRemForm({ ...remForm, due_date: e.target.value })} /></div>
                <div><label>Linked event (optional)</label>
                  <select value={remForm.event_id || ''} onChange={(e) => setRemForm({ ...remForm, event_id: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">None</option>
                    {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                  </select>
                </div>
                <div className="full"><label>Notes</label><textarea value={remForm.notes || ''} onChange={(e) => setRemForm({ ...remForm, notes: e.target.value })} rows={3} /></div>
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <button className="primary" type="submit">Save reminder</button>
                {remForm.id ? <button type="button" onClick={() => setRemForm({})}>Cancel</button> : <button type="button" onClick={() => setRemForm({})}>New reminder</button>}
              </div>
            </form>
          </div>
          {reminders.length === 0 && <p className="empty">No reminders yet. Add your first reminder above.</p>}
          {reminders.map((r) => (
            <div className="card list-item" key={r.id}>
              <div className="row">
                <strong style={{ flex: 1, textDecoration: r.completed ? 'line-through' : 'none' }}>{r.title}</strong>
                <span className="muted">{fmtDate(r.due_date)}{r.event_id ? ` · event #${r.event_id}` : ''}</span>
              </div>
              {r.notes && <p>{r.notes}</p>}
              <div className="row">
                <button onClick={async () => { await put(`/api/reminders/${r.id}`, { completed: !r.completed }); loadReminders(); }}>{r.completed ? 'Reopen' : 'Mark done'}</button>
                <button onClick={() => setRemForm(r)}>Edit</button>
                <button className="danger" onClick={async () => { await del(`/api/reminders/${r.id}`); loadReminders(); }}>Remove</button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
