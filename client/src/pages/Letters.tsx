import { useEffect, useState } from 'react';
import { del, fmtDate, get, post } from '../api';
import type { Donor, Gift, Letter, LetterTemplate } from '../types';

export function Letters() {
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [selectedDonor, setSelectedDonor] = useState<number | ''>('');
  const [selectedGift, setSelectedGift] = useState<number | ''>('');
  const [selectedTemplate, setSelectedTemplate] = useState<number | ''>('');
  const [viewing, setViewing] = useState<Letter | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setTemplates(await get('/api/letter-templates'));
    setLetters(await get('/api/letters'));
    setDonors(await get('/api/donors'));
  }
  useEffect(() => { load().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load.')); }, []);

  async function pickDonor(id: number | '') {
    setSelectedDonor(id);
    setSelectedGift('');
    if (id) setGifts(await get(`/api/donors/${id}/gifts`));
    else setGifts([]);
  }

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const letter = await post('/api/letters', { donor_id: selectedDonor || null, gift_id: selectedGift || null, template_id: selectedTemplate });
      setViewing(letter);
      load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Could not generate.'); }
  }

  return (
    <div>
      <h2>Thank-You Letters</h2>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <h3>Generate a personalized letter</h3>
        <form onSubmit={generate}>
          <div className="form-grid">
            <div><label>Donor</label>
              <select value={selectedDonor} onChange={(e) => pickDonor(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Choose a donor…</option>
                {donors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div><label>Gift (optional)</label>
              <select value={selectedGift} onChange={(e) => setSelectedGift(e.target.value ? Number(e.target.value) : '')}>
                <option value="">No specific gift</option>
                {gifts.map((g) => <option key={g.id} value={g.id}>${Number(g.amount).toFixed(2)} — {fmtDate(g.gift_date)}</option>)}
              </select>
            </div>
            <div className="full"><label>Template</label>
              <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value ? Number(e.target.value) : '')} required>
                <option value="">Choose a template…</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}><button className="primary" type="submit">Generate letter</button></div>
        </form>
      </div>

      {viewing && (
        <div className="card">
          <h3>{viewing.subject}</h3>
          <div className="letter-body">{viewing.body}</div>
          <div className="row no-print" style={{ marginTop: 12 }}>
            <button onClick={() => window.print()}>Print</button>
            <button onClick={() => setViewing(null)}>Close</button>
          </div>
        </div>
      )}

      <h3>Past letters</h3>
      {letters.length === 0 && <p className="empty">No letters generated yet.</p>}
      {letters.map((l) => (
        <div className="card list-item" key={l.id}>
          <div className="row">
            <strong style={{ flex: 1 }}>{l.subject}</strong>
            <span className="muted">{new Date(l.created_at).toLocaleDateString()}</span>
            <button onClick={() => setViewing(l)}>View</button>
            <button className="danger" onClick={async () => { await del(`/api/letters/${l.id}`); load(); }}>Remove</button>
          </div>
        </div>
      ))}
    </div>
  );
}
