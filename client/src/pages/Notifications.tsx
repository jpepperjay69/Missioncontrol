import { useEffect, useState } from 'react';
import { get, post } from '../api';
import type { Notification } from '../types';

export function Notifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState('');

  async function load() { setItems(await get('/api/notifications')); }
  useEffect(() => { load().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load.')); }, []);

  return (
    <div>
      <h2>Notifications</h2>
      <p className="muted">Changes made by any admin show up here: new or edited events, event notes, and industry contact changes, plus due reminders.</p>
      {error && <div className="error">{error}</div>}
      <div className="row" style={{ marginBottom: 12 }}>
        <button onClick={async () => { await post('/api/notifications/read-all', {}); load(); }}>Mark all as read</button>
      </div>
      {items.length === 0 && <p className="empty">No notifications yet.</p>}
      {items.map((n) => (
        <div className="card list-item" key={n.id} style={{ opacity: n.is_read ? 0.7 : 1 }}>
          <div className="row">
            <strong style={{ flex: 1 }}>{n.kind}</strong>
            <span className="muted">{new Date(n.created_at).toLocaleString()}</span>
            {!n.is_read && <button onClick={async () => { await post(`/api/notifications/${n.id}/read`, {}); load(); }}>Mark read</button>}
          </div>
          <p>{n.message}</p>
          {n.actor_name && <p className="muted">By {n.actor_name}</p>}
        </div>
      ))}
    </div>
  );
}
