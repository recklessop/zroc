// src/api/users.js  — user management API calls
const BASE = '/api/admin/users';

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, { credentials: 'include', ...opts });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || `HTTP ${res.status}`), {
      status: res.status,
      detail: body.detail,
    });
  }
  if (res.status === 204) return null;
  return res.json();
}

export const usersApi = {
  list: ({ search = '', page = 1, pageSize = 50 } = {}) => {
    const params = new URLSearchParams({ search, page, pageSize });
    return apiFetch(`${BASE}?${params}`);
  },
  get: (id) => apiFetch(`${BASE}/${id}`),
  create: (body) =>
    apiFetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  update: (id, body) =>
    apiFetch(`${BASE}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  delete: (id) =>
    apiFetch(`${BASE}/${id}`, { method: 'DELETE' }),
  setPassword: (id, password) =>
    apiFetch(`${BASE}/${id}/set-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }),
  setup2fa: (id) =>
    apiFetch(`${BASE}/${id}/setup-2fa`, { method: 'POST' }),
  listGroups: () => apiFetch(`${BASE}/meta/groups`),
};
