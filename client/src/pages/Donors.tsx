import { useEffect, useState } from 'react';
import { del, fmtDate, get, money, post, put } from '../api';
import type { Donor, Gift } from '../types';

export function Donors() {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [selected, setSelected] = useState<Donor | null>(null);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [total, setTotal] = useState<{ n: number; total: string } | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Partial<Donor> | null>(null);
  const [giftForm, setGiftForm] = useState({ amount: '', gift_date: '', method: '', note: '' });

  async function load() {
    try { setDonors(await get('/api/donors')); } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Could not load donors.'); }
  }
  useEffect(() => { load(); }, []);

  async function select(d: Donor) {
    setSelected(d);
    setGifts(await get(`/api/donors/${d.id}/gifts`));
    setTotal(await get(`/api/donors/${d.id}/total`));
  }

  async function saveDonor(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (editing?.id) await put(`/api/donors/${editing.id}`, editing);
      else await post('/api/donors', editing);
      setEditing(null);
      load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Could not save.'); }
  }

  async function saveGift(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    try {
      await post('/api/gifts', { ...giftForm, donor_id: selected.id });
      setGiftForm({ amount: '', gift_date: '', method: '', note: '' });
      select(selected);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Could not save gift.'); }
  }

  return (
    <div>
      <h2>Donors &amp; Donations</h2>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <h3>{editing ? (editing.id ? 'Edit donor' : 'Add a donor') : 'Add a donor'}</h3>
        <form onSubmit={saveDonor}>
          <div className="form-grid">
            <div><label>Name</label><input value={editing?.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required /></div>
            <div><label>Email</label><input type="email" value={editing?.email || ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
            <div><label>Phone</label><input value={editing?.phone || ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
            <div><label>Address</label><input value={editing?.address || ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></div>
            <div className="full"><label>Notes</label><textarea value={editing?.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={3} /></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="primary" type="submit">Save donor</button>
            {editing && <button type="button" onClick={() => setEditing(null)}>Cancel</button>}
            {!editing && <button type="button" onClick={() => setEditing({})}>New donor</button>}
          </div>
        </form>
      </div>

      {donors.length === 0 && <p className="empty">No donors yet. Add your first donor above.</p>}
      {donors.map((d) => (
        <div className="card list-item" key={d.id}>
          <div className="row">
            <strong style={{ flex: 1 }}>{d.name}</strong>
            <button onClick={() => select(d)}>View gifts</button>
            <button onClick={() => setEditing(d)}>Edit</button>
            <button className="danger" onClick={async () => { if (window.confirm(`Remove ${d.name} and all their gifts?`)) { await del(`/api/donors/${d.id}`); if (selected?.id === d.id) setSelected(null); load(); } }}>Remove</button>
          </div>
          {(d.email || d.phone) && <p className="muted">{[d.email, d.phone].filter(Boolean).join(' · ')}</p>}
          {selected?.id === d.id && (
            <div style={{ marginTop: 12 }}>
              <p><strong>{total?.n || 0} gift(s) — total {money(total?.total)}</strong></p>
              <h4>Record a gift</h4>
              <form onSubmit={saveGift}>
                <div className="form-grid">
                  <div><label>Amount</label><input type="number" step="0.01" min="0" value={giftForm.amount} onChange={(e) => setGiftForm({ ...giftForm, amount: e.target.value })} required /></div>
                  <div><label>Date</label><input type="date" value={giftForm.gift_date} onChange={(e) => setGiftForm({ ...giftForm, gift_date: e.target.value })} required /></div>
                  <div><label>Method</label><input value={giftForm.method} onChange={(e) => setGiftForm({ ...giftForm, method: e.target.value })} placeholder="Cash, check, card…" /></div>
                  <div><label>Note</label><input value={giftForm.note} onChange={(e) => setGiftForm({ ...giftForm, note: e.target.value })} /></div>
                </div>
                <div className="row" style={{ marginTop: 12 }}><button className="primary" type="submit">Record gift</button></div>
              </form>
              {gifts.map((g) => (
                <div className="list-item row" key={g.id}>
                  <span style={{ flex: 1 }}>{money(g.amount)} — {fmtDate(g.gift_date)}{g.method ? ` · ${g.method}` : ''}{g.note ? ` · ${g.note}` : ''}</span>
                  <button className="danger" onClick={async () => { await del(`/api/gifts/${g.id}`); select(d); }}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
