import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import Chip from '../components/Chip.jsx';
import Modal from '../components/Modal.jsx';

const ALERT_CATEGORIES = ['schedule', 'project', 'scope', 'color', 'order', 'photo', 'note', 'receipt'];

function AddCrewModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ display_name: '', short_name: '', chip_color: '#5B4FBF', phone: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await api.post('/team', form);
      onCreated(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2 style={{ marginTop: 0 }}>Add crew</h2>
      <form onSubmit={submit}>
        <div className="field">
          <label>Crew name</label>
          <input required value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
        </div>
        <div className="field">
          <label>Short name (chip)</label>
          <input value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} placeholder="e.g. RMPP" />
        </div>
        <div className="field">
          <label>Chip color</label>
          <input type="color" value={form.chip_color} onChange={(e) => setForm({ ...form, chip_color: e.target.value })} />
        </div>
        <div className="field">
          <label>Phone</label>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1..." />
        </div>
        {error && <div className="login-error" style={{ color: '#b3261e' }}>{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Adding…' : 'Add'}</button>
        </div>
      </form>
    </Modal>
  );
}

function TeamCard({ user, onChange }) {
  const [phone, setPhone] = useState(user.phone || '');
  const [tempPassword, setTempPassword] = useState(null);

  const savePhone = async () => {
    const updated = await api.patch(`/team/${user.id}`, { phone });
    onChange(updated);
  };

  const togglePref = async (category) => {
    const next = { ...user.alert_prefs, [category]: user.alert_prefs[category] ? 0 : 1 };
    const updated = await api.patch(`/team/${user.id}`, { alert_prefs: next });
    onChange(updated);
  };

  const deactivate = async () => {
    if (!confirm(`Deactivate ${user.display_name}?`)) return;
    const updated = await api.patch(`/team/${user.id}`, { active: !user.active });
    onChange(updated);
  };

  const resetPassword = async () => {
    if (!confirm(`Reset password for ${user.display_name}? They'll be logged out everywhere.`)) return;
    const data = await api.post(`/team/${user.id}/reset-password`);
    setTempPassword(data.temp_password);
  };

  return (
    <div className="team-card" style={{ opacity: user.active ? 1 : 0.5 }}>
      <div className="team-head">
        <Chip color={user.chip_color} label={user.short_name} />
        <div style={{ flex: 1 }}>
          <strong>{user.display_name}</strong>
          {!user.active && <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: '0.8rem' }}>(deactivated)</span>}
        </div>
      </div>

      <div className="field" style={{ marginBottom: 8 }}>
        <label>Phone number</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1..." />
          <button className="btn btn-secondary" onClick={savePhone}>Save</button>
        </div>
      </div>

      <div className="pref-toggles">
        {ALERT_CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`pref-chip ${user.alert_prefs[cat] ? 'on' : ''}`}
            onClick={() => togglePref(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {tempPassword && (
        <div className="empty-state" style={{ background: '#eef1f4', borderRadius: 8, padding: 10, marginTop: 10, textAlign: 'left' }}>
          New temporary password (shown once): <strong>{tempPassword}</strong>
        </div>
      )}

      <div className="team-actions">
        <button className="btn btn-secondary" onClick={resetPassword}>Reset password</button>
        {user.role === 'crew' && (
          <button className="btn btn-danger" onClick={deactivate}>{user.active ? 'Deactivate' : 'Reactivate'}</button>
        )}
      </div>
    </div>
  );
}

export default function TeamPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTempPassword, setNewTempPassword] = useState(null);

  const load = async () => {
    const rows = await api.get('/team');
    setUsers(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onChange = (updated) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  };

  if (loading) return <div className="page"><div className="loading-state">Loading…</div></div>;

  return (
    <div className="page">
      <div className="page-title-row">
        <h1>Team</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add crew</button>
      </div>

      {newTempPassword && (
        <div className="empty-state" style={{ background: '#eef1f4', borderRadius: 8, padding: 10, marginBottom: 12, textAlign: 'left' }}>
          Temporary password for new crew (shown once): <strong>{newTempPassword}</strong>
        </div>
      )}

      <div className="team-grid">
        {users.map((u) => <TeamCard key={u.id} user={u} onChange={onChange} />)}
      </div>

      {showAdd && (
        <AddCrewModal
          onClose={() => setShowAdd(false)}
          onCreated={(user) => {
            setUsers((prev) => [...prev, user]);
            setNewTempPassword(user.temp_password);
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}
