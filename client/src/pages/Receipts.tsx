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
  const [selectedName, setSelectedName] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  async function load() { setReceipts(await get('/api/receipts')); }
  useEffect(() => { load().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load.')); }, []);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>, other: React.RefObject<HTMLInputElement | null>) {
    const f = e.target.files?.[0];
    if (other.current) other.current.value = '';
    if (!f) { setSelectedName(''); setPreviewUrl(''); return; }
    setSelectedName(f.name);
    setPreviewUrl(f.type.startsWith('image/') ? URL.createObjectURL(f) : '');
  }

  // Shrink a phone photo before upload so receipts stay small in the
  // database and upload fast. Falls back to the original on any failure.
  // Also converts phone formats (e.g. HEIC) to plain JPEG.
  async function shrinkImage(file: File): Promise<Blob> {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('decode'));
        img.src = url;
      });
      const maxEdge = 1600;
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); return file; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      return blob || file;
    } catch { return file; }
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const raw = cameraRef.current?.files?.[0] || fileRef.current?.files?.[0];
    if (!raw) { setError('Take a photo or choose a file of the receipt first.'); return; }
    setError(''); setMsg('');
    let file: Blob = raw;
    let fileName = raw.name;
    if (raw.type.startsWith('image/')) {
      file = await shrinkImage(raw);
      if (file !== raw) fileName = raw.name.replace(/\.[^.]+$/, '') + '.jpg';
    }
    const form = new FormData();
    form.append('file', file, fileName);
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
      if (cameraRef.current) cameraRef.current.value = '';
      setSelectedName(''); setPreviewUrl('');
      setMsg('Receipt filed.');
      load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Upload failed.'); }
  }

  return (
    <div>
      <h2>Receipts</h2>
      <p className="muted">Snap a receipt with your phone camera and file it here. Receipts are stored safely in the database, so they survive redeploys.</p>
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
            <div className="full"><label>Take a photo</label><input type="file" ref={cameraRef} accept="image/*" capture="environment" onChange={(e) => onPick(e, fileRef)} /></div>
            <div className="full"><label>Or choose a file</label><input type="file" ref={fileRef} accept="image/*,application/pdf" onChange={(e) => onPick(e, cameraRef)} /></div>
            {selectedName && <p className="muted">Selected: {selectedName} · photos are shrunk to filing size before upload.</p>}
            {previewUrl && <div className="full"><img src={previewUrl} alt="Receipt preview" style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8 }} /></div>}
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
