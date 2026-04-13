// src/pages/Settings/UserManagement.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { Users, UserPlus, Search, Shield, ShieldOff, ShieldCheck, Pencil, Trash2, QrCode, X, Check, Loader2, AlertTriangle, Copy, ExternalLink } from 'lucide-react';
import { usersApi } from '@/api/users';
import clsx from 'clsx';

function Avatar({ name, size = 'md' }) {
  const initials = name ? name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() : '?';
  const colors = ['bg-accent/20 text-accent', 'bg-ok/20 text-ok', 'bg-info/20 text-info', 'bg-warn/20 text-warn'];
  const color = colors[(name?.charCodeAt(0) ?? 0) % colors.length];
  const sz = size === 'lg' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs';
  return <div className={clsx('rounded-full flex items-center justify-center font-mono font-semibold flex-shrink-0', sz, color)}>{initials}</div>;
}

function Toast({ message, type = 'ok', onDismiss }) {
  useEffect(() => { const t = setTimeout(onDismiss, 3500); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div className={clsx('fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-lg border shadow-panel animate-fade-in',
      type === 'ok' && 'bg-surface border-ok/30 text-ok', type === 'error' && 'bg-surface border-crit/30 text-crit')}>
      {type === 'ok' && <Check size={14} />}{type === 'error' && <AlertTriangle size={14} />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onDismiss} className="ml-2 text-text-muted hover:text-text-primary"><X size={12} /></button>
    </div>
  );
}

function DeleteModal({ user, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="drawer-overlay" onClick={onCancel} />
      <div className="card-raised p-6 w-full max-w-sm z-10 animate-modal-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-crit/10 flex items-center justify-center"><Trash2 size={18} className="text-crit" /></div>
          <div><p className="font-medium text-text-primary">Delete user</p><p className="text-xs text-text-muted">This cannot be undone</p></div>
        </div>
        <p className="text-sm text-text-secondary mb-6">Delete <span className="text-text-primary font-medium">{user.name}</span> ({user.username})?</p>
        <div className="flex justify-end gap-3">
          <button className="btn-ghost" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className="btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function TwoFactorModal({ user, onClose }) {
  const [state, setState] = useState('idle');
  const [result, setResult] = useState(null);
  const generate = useCallback(async () => {
    setState('loading');
    try { const data = await usersApi.setup2fa(user.id); setResult(data); setState('done'); }
    catch { setState('error'); }
  }, [user.id]);
  useEffect(() => { generate(); }, [generate]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="drawer-overlay" onClick={onClose} />
      <div className="card-raised p-6 w-full max-w-md z-10 animate-modal-in">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center"><QrCode size={18} className="text-accent" /></div>
            <div><p className="font-medium text-text-primary">Set up 2FA</p><p className="text-xs text-text-muted">{user.name}</p></div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={16} /></button>
        </div>
        {state === 'loading' && <div className="flex flex-col items-center py-10 gap-3"><Loader2 size={28} className="animate-spin text-accent" /><p className="text-sm text-text-muted">Generating setup link…</p></div>}
        {state === 'error' && <div className="flex flex-col items-center py-8 gap-3 text-crit"><AlertTriangle size={28} /><p className="text-sm">Failed to generate setup link.</p><button className="btn-ghost mt-2" onClick={generate}>Retry</button></div>}
        {state === 'done' && result && (
          <>
            <div className="bg-canvas rounded-lg p-1 flex justify-center mb-4 border border-border">
              <img src={result.qrDataUrl} alt="2FA setup QR code" className="w-56 h-56 rounded" />
            </div>
            <p className="text-sm text-text-secondary mb-5">Share this QR code with {user.name} to enroll their authenticator app.</p>
            <button className="btn-ghost w-full" onClick={onClose}>Done</button>
          </>
        )}
      </div>
    </div>
  );
}

function UserDrawer({ mode, user, groups, onSave, onClose }) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState(isEdit ? {
    username: user.username, name: user.name, email: user.email,
    isActive: user.isActive, groups: user.groups.map((g) => g.id), password: '',
  } : { username: '', name: '', email: '', isActive: true, groups: [], password: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const toggleGroup = (id) => setForm((f) => ({ ...f, groups: f.groups.includes(id) ? f.groups.filter((g) => g !== id) : [...f.groups, id] }));

  const handleSubmit = async () => {
    const e = {};
    if (!form.username.trim()) e.username = 'Required';
    if (!form.name.trim()) e.name = 'Required';
    if (!form.email.trim()) e.email = 'Required';
    if (!isEdit && !form.password) e.password = 'Required';
    if (form.password && form.password.length < 8) e.password = 'Min 8 chars';
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSaving(true);
    try {
      const payload = { username: form.username, name: form.name, email: form.email, isActive: form.isActive, groups: form.groups };
      if (form.password) payload.password = form.password;
      await onSave(payload);
    } finally { setSaving(false); }
  };

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-panel">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <p className="font-medium text-text-primary">{isEdit ? 'Edit user' : 'Add user'}</p>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <section>
            <p className="section-title mb-4">Identity</p>
            <div className="space-y-4">
              <div><label className="field-label">Username</label><input className={clsx('field', errors.username && 'border-crit')} value={form.username} onChange={set('username')} disabled={isEdit} /></div>
              <div><label className="field-label">Full name</label><input className={clsx('field', errors.name && 'border-crit')} value={form.name} onChange={set('name')} /></div>
              <div><label className="field-label">Email</label><input className={clsx('field', errors.email && 'border-crit')} type="email" value={form.email} onChange={set('email')} /></div>
            </div>
          </section>
          <section>
            <p className="section-title mb-3">Groups</p>
            <div className="space-y-2">
              {groups.map((g) => (
                <label key={g.id} className="flex items-center gap-3 cursor-pointer py-2 px-3 rounded-md hover:bg-canvas transition-colors">
                  <input type="checkbox" className="sr-only" checked={form.groups.includes(g.id)} onChange={() => toggleGroup(g.id)} />
                  <div className={clsx('w-4 h-4 rounded border flex items-center justify-center',
                    form.groups.includes(g.id) ? 'bg-accent border-accent' : 'border-border')}>
                    {form.groups.includes(g.id) && <Check size={10} className="text-white" />}
                  </div>
                  <span className="text-sm text-text-primary">{g.name}</span>
                </label>
              ))}
            </div>
          </section>
          <section>
            <p className="section-title mb-3">{isEdit ? 'Reset Password' : 'Password'}</p>
            <input className={clsx('field', errors.password && 'border-crit')} type="password" value={form.password} onChange={set('password')}
              placeholder={isEdit ? 'Leave blank to keep' : 'Min. 8 characters'} />
            {errors.password && <p className="text-xs text-crit mt-1">{errors.password}</p>}
          </section>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border flex-shrink-0">
          <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : isEdit ? <Check size={14} /> : <UserPlus size={14} />}
            {isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </>
  );
}

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [drawer, setDrawer] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [twoFaTarget, setTwoFaTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const searchTimer = useRef(null);

  const showToast = (message, type = 'ok') => setToast({ message, type });

  const loadUsers = useCallback(async (q = '') => {
    setLoading(true);
    try { const result = await usersApi.list({ search: q }); setUsers(result.users); setTotal(result.count); }
    catch (err) { showToast(`Failed to load users: ${err.message}`, 'error'); }
    finally { setLoading(false); }
  }, []);

  const loadGroups = useCallback(async () => {
    try { const g = await usersApi.listGroups(); setGroups(g); } catch {}
  }, []);

  useEffect(() => { loadUsers(); loadGroups(); }, []);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadUsers(val), 350);
  };

  const handleSave = async (payload) => {
    try {
      if (drawer.mode === 'create') {
        const newUser = await usersApi.create(payload);
        setUsers((u) => [newUser, ...u]); setTotal((t) => t + 1);
        showToast(`User ${newUser.username} created`);
      } else {
        const updated = await usersApi.update(drawer.user.id, payload);
        setUsers((u) => u.map((x) => (x.id === updated.id ? updated : x)));
        showToast(`User ${updated.username} updated`);
      }
      setDrawer(null);
    } catch (err) { showToast(err.message, 'error'); throw err; }
  };

  const handleDelete = async () => {
    try {
      await usersApi.delete(deleteTarget.id);
      setUsers((u) => u.filter((x) => x.id !== deleteTarget.id)); setTotal((t) => t - 1);
      showToast(`User ${deleteTarget.username} deleted`); setDeleteTarget(null);
    } catch (err) { showToast(err.message, 'error'); }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-mono text-lg font-semibold text-text-primary flex items-center gap-2">
            <Users size={20} className="text-accent" /> User Management
          </h1>
          <p className="text-xs text-text-muted mt-1">{total} users</p>
        </div>
        <button className="btn-primary" onClick={() => setDrawer({ mode: 'create' })}><UserPlus size={15} /> Add User</button>
      </div>

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <input className="field pl-9" placeholder="Search…" value={searchInput} onChange={handleSearchChange} />
      </div>

      <div className="card flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border">
            <th className="px-4 py-3 text-left section-title">User</th>
            <th className="px-4 py-3 text-left section-title hidden md:table-cell">Groups</th>
            <th className="px-4 py-3 text-left section-title">Status</th>
            <th className="px-4 py-3 text-left section-title hidden lg:table-cell">2FA</th>
            <th className="px-4 py-3 text-right section-title">Actions</th>
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-4 py-16 text-center"><Loader2 size={20} className="animate-spin text-text-muted mx-auto" /></td></tr>}
            {!loading && users.length === 0 && <tr><td colSpan={5} className="px-4 py-16 text-center text-text-muted">No users found</td></tr>}
            {!loading && users.map((u) => (
              <tr key={u.id} className="table-row-hover border-b border-border/50 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} />
                    <div><p className="font-medium text-text-primary">{u.name}</p><p className="text-xs text-text-muted font-mono">{u.username}</p></div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {u.groups.length === 0 ? <span className="text-xs text-text-muted">—</span> : u.groups.map((g) => (
                      <span key={g.id} className={clsx('badge', g.name.includes('admin') ? 'badge-info' : 'badge-muted')}>{g.name}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {u.isActive ? <span className="badge badge-ok">Active</span> : <span className="badge badge-muted">Inactive</span>}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  {u.totpEnrolled ? <span className="badge badge-ok"><ShieldCheck size={10} />2FA On</span> : <span className="badge badge-warn"><ShieldOff size={10} />No 2FA</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button title="Edit" onClick={() => setDrawer({ mode: 'edit', user: u })} className="p-1.5 rounded text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"><Pencil size={13} /></button>
                    <button title="2FA" onClick={() => setTwoFaTarget(u)} className="p-1.5 rounded text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"><Shield size={13} /></button>
                    <button title="Delete" onClick={() => setDeleteTarget(u)} className="p-1.5 rounded text-text-muted hover:text-crit hover:bg-crit/10 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drawer && <UserDrawer mode={drawer.mode} user={drawer.user} groups={groups} onSave={handleSave} onClose={() => setDrawer(null)} />}
      {deleteTarget && <DeleteModal user={deleteTarget} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />}
      {twoFaTarget && <TwoFactorModal user={twoFaTarget} onClose={() => { setTwoFaTarget(null); loadUsers(); }} />}
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
