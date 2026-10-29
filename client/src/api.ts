export async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

export const get = (path: string) => api(path);
export const post = (path: string, body: unknown) => api(path, { method: 'POST', body: JSON.stringify(body) });
export const put = (path: string, body: unknown) => api(path, { method: 'PUT', body: JSON.stringify(body) });
export const del = (path: string) => api(path, { method: 'DELETE' });

export function money(n: unknown): string {
  const v = Number(n);
  if (Number.isNaN(v)) return '$0.00';
  return '$' + v.toFixed(2);
}

export function fmtDate(d: unknown): string {
  if (!d) return '';
  return String(d).slice(0, 10);
}
