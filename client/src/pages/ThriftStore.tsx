import { useEffect, useState } from 'react';
import { del, fmtDate, get, money, post, put } from '../api';
import type { MeetingNote, Payroll, Staff, TruckExpense } from '../types';

type Tab = 'staff' | 'notes' | 'payroll' | 'truck';

export function ThriftStore() {
  const [tab, setTab] = useState<Tab>('staff');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [payroll, setPayroll] = useState<Payroll[]>([]);
  const [truck, setTruck] = useState<TruckExpense[]>([]);
  const [error, setError] = useState('');

  async function loadAll() {
    setStaff(await get('/api/thrift-staff'));
    setNotes(await get('/api/thrift-meeting-notes'));
    setPayroll(await get('/api/thrift-payroll'));
    setTruck(await get('/api/thrift-truck-expenses'));
  }
  useEffect(() => { loadAll().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load.')); }, []);

  return (
    <div>
      <h2>Thrift Store</h2>
      {error && <div className="error">{error}</div>}
      <div className="tabs">
        <button className={tab === 'staff' ? 'active' : ''} onClick={() => setTab('staff')}>Staff</button>
        <button className={tab === 'notes' ? 'active' : ''} onClick={() => setTab('notes')}>Meeting Notes</button>
        <button className={tab === 'payroll' ? 'active' : ''} onClick={() => setTab('payroll')}>Payroll</button>
        <button className={tab === 'truck' ? 'active' : ''} onClick={() => setTab('truck')}>Truck Expenses</button>
      </div>
      {tab === 'staff' && <StaffTab staff={staff} reload={loadAll} setError={setError} />}
      {tab === 'notes' && <NotesTab notes={notes} reload={loadAll} setError={setError} />}
      {tab === 'payroll' && <PayrollTab payroll={payroll} staff={staff} reload={loadAll} setError={setError} />}
      {tab === 'truck' && <TruckTab truck={truck} reload={loadAll} setError={setError} />}
    </div>
  );
}

function StaffTab({ staff, reload, setError }: { staff: Staff[]; reload: () => void; setError: (s: string) => void }) {
  const [f, setF] = useState<Partial<Staff>>({});
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (f.id) await put(`/api/thrift-staff/${f.id}`, f); else await post('/api/thrift-staff', f);
      setF({}); reload();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Could not save.'); }
  }
  return (
    <div>
      <div className="card">
        <h3>{f.id ? 'Edit staff member' : 'Add a staff member'}</h3>
        <form onSubmit={save}>
          <div className="form-grid">
            <div><label>Name</label><input value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>
            <div><label>Role</label><input value={f.role || ''} onChange={(e) => setF({ ...f, role: e.target.value })} /></div>
            <div><label>Phone</label><input value={f.phone || ''} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
            <div><label>Email</label><input type="email" value={f.email || ''} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            <div><label>Hire date</label><input type="date" value={fmtDate(f.hire_date)} onChange={(e) => setF({ ...f, hire_date: e.target.value })} /></div>
            <div className="full"><label>Notes</label><textarea value={f.notes || ''} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} /></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="primary" type="submit">Save</button>
            {f.id ? <button type="button" onClick={() => setF({})}>Cancel</button> : <button type="button" onClick={() => setF({})}>New</button>}
          </div>
        </form>
      </div>
      {staff.length === 0 && <p className="empty">No staff yet.</p>}
      {staff.map((s) => (
        <div className="card list-item" key={s.id}>
          <div className="row">
            <strong style={{ flex: 1 }}>{s.name}</strong>
            <button onClick={() => setF(s)}>Edit</button>
            <button className="danger" onClick={async () => { await del(`/api/thrift-staff/${s.id}`); reload(); }}>Remove</button>
          </div>
          <p className="muted">{[s.role, s.phone, s.email].filter(Boolean).join(' · ')}</p>
        </div>
      ))}
    </div>
  );
}

function NotesTab({ notes, reload, setError }: { notes: MeetingNote[]; reload: () => void; setError: (s: string) => void }) {
  const [f, setF] = useState<Partial<MeetingNote>>({});
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (f.id) await put(`/api/thrift-meeting-notes/${f.id}`, f); else await post('/api/thrift-meeting-notes', f);
      setF({}); reload();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Could not save.'); }
  }
  return (
    <div>
      <div className="card">
        <h3>{f.id ? 'Edit meeting note' : 'Add a meeting note'}</h3>
        <form onSubmit={save}>
          <div className="form-grid">
            <div><label>Title</label><input value={f.title || ''} onChange={(e) => setF({ ...f, title: e.target.value })} required /></div>
            <div><label>Date</label><input type="date" value={fmtDate(f.meeting_date)} onChange={(e) => setF({ ...f, meeting_date: e.target.value })} /></div>
            <div className="full"><label>Notes</label><textarea value={f.body || ''} onChange={(e) => setF({ ...f, body: e.target.value })} rows={5} required /></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="primary" type="submit">Save</button>
            {f.id ? <button type="button" onClick={() => setF({})}>Cancel</button> : <button type="button" onClick={() => setF({})}>New</button>}
          </div>
        </form>
      </div>
      {notes.length === 0 && <p className="empty">No meeting notes yet.</p>}
      {notes.map((n) => (
        <div className="card" key={n.id}>
          <div className="row">
            <strong style={{ flex: 1 }}>{n.title}</strong>
            <span className="muted">{fmtDate(n.meeting_date)}</span>
            <button onClick={() => setF(n)}>Edit</button>
            <button className="danger" onClick={async () => { await del(`/api/thrift-meeting-notes/${n.id}`); reload(); }}>Remove</button>
          </div>
          <p style={{ whiteSpace: 'pre-wrap' }}>{n.body}</p>
        </div>
      ))}
    </div>
  );
}

function PayrollTab({ payroll, staff, reload, setError }: { payroll: Payroll[]; staff: Staff[]; reload: () => void; setError: (s: string) => void }) {
  const [f, setF] = useState<Partial<Payroll>>({});
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...f, staff_id: f.staff_id ? Number(f.staff_id) : null, paid: !!f.paid };
    try {
      if (f.id) await put(`/api/thrift-payroll/${f.id}`, body); else await post('/api/thrift-payroll', body);
      setF({}); reload();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Could not save.'); }
  }
  return (
    <div>
      <div className="card">
        <h3>{f.id ? 'Edit payroll entry' : 'Add a payroll entry'}</h3>
        <form onSubmit={save}>
          <div className="form-grid">
            <div><label>Staff member</label>
              <select value={f.staff_id || ''} onChange={(e) => setF({ ...f, staff_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Choose…</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label>Period start</label><input type="date" value={fmtDate(f.period_start)} onChange={(e) => setF({ ...f, period_start: e.target.value })} /></div>
            <div><label>Period end</label><input type="date" value={fmtDate(f.period_end)} onChange={(e) => setF({ ...f, period_end: e.target.value })} /></div>
            <div><label>Hours</label><input type="number" step="0.01" value={f.hours || ''} onChange={(e) => setF({ ...f, hours: e.target.value })} /></div>
            <div><label>Hourly rate</label><input type="number" step="0.01" value={f.rate || ''} onChange={(e) => setF({ ...f, rate: e.target.value })} /></div>
            <div><label>Amount</label><input type="number" step="0.01" value={f.amount || ''} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
            <div><label><input type="checkbox" checked={!!f.paid} onChange={(e) => setF({ ...f, paid: e.target.checked })} style={{ width: 'auto' }} /> Paid</label></div>
            <div className="full"><label>Note</label><input value={f.note || ''} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="primary" type="submit">Save</button>
            {f.id ? <button type="button" onClick={() => setF({})}>Cancel</button> : <button type="button" onClick={() => setF({})}>New</button>}
          </div>
        </form>
      </div>
      {payroll.length === 0 && <p className="empty">No payroll entries yet.</p>}
      {payroll.map((p) => (
        <div className="card list-item" key={p.id}>
          <div className="row">
            <strong style={{ flex: 1 }}>{staff.find((s) => s.id === p.staff_id)?.name || 'Unassigned'} — {money(p.amount)}</strong>
            <span className="muted">{fmtDate(p.period_start)} to {fmtDate(p.period_end)} · {p.paid ? 'Paid' : 'Unpaid'}</span>
            <button onClick={() => setF(p)}>Edit</button>
            <button className="danger" onClick={async () => { await del(`/api/thrift-payroll/${p.id}`); reload(); }}>Remove</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function TruckTab({ truck, reload, setError }: { truck: TruckExpense[]; reload: () => void; setError: (s: string) => void }) {
  const [f, setF] = useState<Partial<TruckExpense>>({});
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (f.id) await put(`/api/thrift-truck-expenses/${f.id}`, f); else await post('/api/thrift-truck-expenses', f);
      setF({}); reload();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Could not save.'); }
  }
  return (
    <div>
      <div className="card">
        <h3>{f.id ? 'Edit truck expense' : 'Add a truck expense'}</h3>
        <form onSubmit={save}>
          <div className="form-grid">
            <div><label>Description</label><input value={f.description || ''} onChange={(e) => setF({ ...f, description: e.target.value })} required /></div>
            <div><label>Category</label><input value={f.category || ''} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Fuel, repair, insurance…" /></div>
            <div><label>Date</label><input type="date" value={fmtDate(f.expense_date)} onChange={(e) => setF({ ...f, expense_date: e.target.value })} /></div>
            <div><label>Amount</label><input type="number" step="0.01" min="0" value={f.amount || ''} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></div>
            <div className="full"><label>Note</label><input value={f.note || ''} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="primary" type="submit">Save</button>
            {f.id ? <button type="button" onClick={() => setF({})}>Cancel</button> : <button type="button" onClick={() => setF({})}>New</button>}
          </div>
        </form>
      </div>
      {truck.length === 0 && <p className="empty">No truck expenses yet.</p>}
      {truck.map((t) => (
        <div className="card list-item" key={t.id}>
          <div className="row">
            <strong style={{ flex: 1 }}>{t.description} — {money(t.amount)}</strong>
            <span className="muted">{fmtDate(t.expense_date)}{t.category ? ` · ${t.category}` : ''}</span>
            <button onClick={() => setF(t)}>Edit</button>
            <button className="danger" onClick={async () => { await del(`/api/thrift-truck-expenses/${t.id}`); reload(); }}>Remove</button>
          </div>
        </div>
      ))}
    </div>
  );
}
