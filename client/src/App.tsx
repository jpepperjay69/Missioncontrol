import { useEffect, useState } from 'react';
import { get, post } from './api';
import type { User } from './types';
import { AuthGate } from './pages/Auth';
import { Home } from './pages/Home';
import { Donors } from './pages/Donors';
import { Events } from './pages/Events';
import { Contacts } from './pages/Contacts';
import { Letters } from './pages/Letters';
import { ThriftStore } from './pages/ThriftStore';
import { Receipts } from './pages/Receipts';
import { Forms } from './pages/Forms';
import { Notes } from './pages/Notes';
import { Notifications } from './pages/Notifications';

type Page = 'home' | 'donors' | 'events' | 'contacts' | 'letters' | 'thrift' | 'receipts' | 'forms' | 'notes' | 'notifications';

const NAV: { key: Page; label: string }[] = [
  { key: 'donors', label: 'Donors' },
  { key: 'events', label: 'Events' },
  { key: 'contacts', label: 'Industry Contacts' },
  { key: 'letters', label: 'Thank-You Letters' },
  { key: 'thrift', label: 'Thrift Store' },
  { key: 'receipts', label: 'Receipts' },
  { key: 'forms', label: 'Forms' },
  { key: 'notes', label: 'Notepad' },
  { key: 'notifications', label: 'Notifications' },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<Page>('home');
  const [unread, setUnread] = useState(0);

  async function refreshAuth() {
    try {
      const s = await get('/api/auth/status');
      setNeedsSetup(s.needsSetup);
      setUser(s.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function refreshUnread() {
    try {
      const s = await get('/api/stats');
      setUnread(s.unreadNotifications);
    } catch { /* ignore */ }
  }

  useEffect(() => { refreshAuth(); }, []);
  useEffect(() => {
    if (user) {
      refreshUnread();
      const t = setInterval(refreshUnread, 60000);
      return () => clearInterval(t);
    }
  }, [user, page]);

  async function logout() {
    await post('/api/auth/logout', {});
    setUser(null);
    setPage('home');
  }

  if (loading) return <div className="main"><p className="muted">Loading Mission Control…</p></div>;
  if (!user) return <AuthGate needsSetup={needsSetup} onDone={(u) => { setUser(u); setPage('home'); }} />;

  return (
    <div>
      <div className="topbar">
        <button className="home-btn" onClick={() => setPage('home')}>Mission Control home</button>
        <h1>Mission Control</h1>
        <span>{user.name}</span>
        <button onClick={logout}>Sign out</button>
      </div>
      <div className="nav">
        {NAV.map((n) => (
          <button key={n.key} className={page === n.key ? 'active' : ''} onClick={() => setPage(n.key)}>
            {n.label}
            {n.key === 'notifications' && unread > 0 && <span className="badge">{unread}</span>}
          </button>
        ))}
      </div>
      <div className="main">
        {page === 'home' && <Home go={(p) => setPage(p as Page)} me={user} />}
        {page === 'donors' && <Donors />}
        {page === 'events' && <Events />}
        {page === 'contacts' && <Contacts />}
        {page === 'letters' && <Letters />}
        {page === 'thrift' && <ThriftStore />}
        {page === 'receipts' && <Receipts />}
        {page === 'forms' && <Forms />}
        {page === 'notes' && <Notes />}
        {page === 'notifications' && <Notifications />}
      </div>
    </div>
  );
}
