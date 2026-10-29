import { useEffect, useRef, useState } from 'react';
import { del, fmtDate, get, money } from '../api';
import type { Receipt } from '../types';

export function Receipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [title, setTitle] = useState('');
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [receiptDate, setReceiptDate] = useState('');
  const [note, setNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() { setReceipts(await get('/api/receipts')); }
  useEffect(() => { load().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load.')); }, []);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { setError('Choose a photo or file of the receipt first.'); return; }
    setError(''); setMsg('');
    const form = new FormData();
    form.append('file', file);
    form.append('title', title);
    form.append('vendor', vendor);
    form.append('amount', amount);
    form.append('receipt_date', receiptDate);
    form.append('note', note);
    try {
      const res = await fetch('/api/receipts', { method: 'POST', credentials: 'include', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed.');
      setTitle(''); setVendor(''); setAmount(''); setReceiptDate(''); setNote('');
      if (fileRef.current) fileRef.current.value = '';
      setMsg('Receipt filed.');
      load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Upload failed.'); }
  }

  return (
    <div>
      <h2>Receipts</h2>
      <p className="muted">Scan or photograph a receipt and file it here. Receipts are stored safely in the database, so they survive redeploys.</p>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}
      <div className="card">
        <h3>File a receipt</h3>
        <form onSubmit={upload}>
          <div className="form-grid">
            <div><label>Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Office supplies, fuel…" /></div>
            <div><label>Vendor</label><input value={vendor} onChange={(e) => setVendor(e.target.value)} /></div>
            <div><label>Amount</label><input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div><label>Date</label><input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} /></div>
            <div className="full"><label>Photo or file</label><input type="file" ref={fileRef} accept="image/*,application/pdf" required /></div>
            <div className="full"><label>Note</label><input value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}><button className="primary" type="submit">File receipt</button></div>
        </form>
      </div>
      {receipts.length === 0 && <p className="empty">No receipts filed yet.</p>}
      {receipts.map((r) => (
        <div className="card list-item" key={r.id}>
          <div className="row">
            <strong style={{ flex: 1 }}>{r.title}</strong>
            <span className="muted">{r.vendor || ''}{r.amount ? ` · ${money(r.amount)}` : ''} · {fmtDate(r.receipt_date)}</span>
            <a href={`/api/receipts/${r.id}/file`} target="_blank" rel="noreferrer"><button type="button">View</button></a>
            <button className="danger" onClick={async () => { await del(`/api/receipts/${r.id}`); load(); }}>Remove</button>
          </div>
          {r.note && <p>{r.note}</p>}
        </div>
      ))}
    </div>
  );
}
