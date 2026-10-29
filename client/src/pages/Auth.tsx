import { useState } from 'react';
import { post } from '../api';
import type { User } from '../types';

export function AuthGate({ needsSetup, onDone }: { needsSetup: boolean; onDone: (u: User) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = needsSetup
        ? await post('/api/auth/setup', { name, email, password })
        : await post('/api/auth/login', { email, password });
      onDone(user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="main">
      <div className="card">
        <h2>{needsSetup ? 'Welcome — set up the first admin account' : 'Sign in to Mission Control'}</h2>
        {needsSetup && (
          <p className="muted">
            This is a one-time setup. The first account you create here is an admin, and once
            signed in you can add more admin accounts from the home page's Admin accounts card.
          </p>
        )}
        {error && <div className="error">{error}</div>}
        <form onSubmit={submit}>
          {needsSetup && (
            <>
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </>
          )}
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <div className="row" style={{ marginTop: 16 }}>
            <button className="primary" type="submit" disabled={busy}>
              {needsSetup ? 'Create admin account' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
