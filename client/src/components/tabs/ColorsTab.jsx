import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import Modal from '../Modal.jsx';
import PhotoGrid from '../PhotoGrid.jsx';

function AddColorModal({ projectId, onClose, onCreated }) {
  const [form, setForm] = useState({ manufacturer: '', name: '', code: '', hex: '#c7791b', sheen: '', location_note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const color = await api.post(`/projects/${projectId}/colors`, form);
      onCreated(color);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2 style={{ marginTop: 0 }}>Add color</h2>
      <form onSubmit={submit}>
        <div className="field">
          <label>Manufacturer</label>
          <input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
        </div>
        <div className="field">
          <label>Name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label>Code</label>
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. SW 7029" />
        </div>
        <div className="field">
          <label>Swatch color</label>
          <input type="color" value={form.hex} onChange={(e) => setForm({ ...form, hex: e.target.value })} />
        </div>
        <div className="field">
          <label>Sheen</label>
          <input value={form.sheen} onChange={(e) => setForm({ ...form, sheen: e.target.value })} placeholder="e.g. Eggshell" />
        </div>
        <div className="field">
          <label>Location / use</label>
          <input value={form.location_note} onChange={(e) => setForm({ ...form, location_note: e.target.value })} placeholder="e.g. Lobby walls" />
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

export default function ColorsTab({ projectId, isAdmin, onCountChange, onPictureCountChange }) {
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    api.get(`/projects/${projectId}/colors`).then((rows) => { setColors(rows); setLoading(false); });
  }, [projectId]);

  if (loading) return <div className="loading-state">Loading…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Approved colors</h3>
        {isAdmin && <button className="btn btn-secondary" onClick={() => setShowAdd(true)}>+ Add color</button>}
      </div>

      {colors.length === 0 ? (
        <div className="empty-state">No colors approved yet.</div>
      ) : (
        <div className="color-grid">
          {colors.map((c) => (
            <div key={c.id} className="color-card">
              <div className="color-swatch" style={{ background: c.hex || '#ccc' }} />
              <div>
                <div className="name">{c.name || c.code}</div>
                <div className="sub">{[c.manufacturer, c.code].filter(Boolean).join(' · ')}</div>
                <div className="sub">{c.sheen}</div>
                {c.location_note && <div className="sub">{c.location_note}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ marginTop: 24 }}>Renderings</h3>
      <PhotoGrid projectId={projectId} kind="rendering" canUpload={isAdmin} canDelete={isAdmin} onCountChange={onPictureCountChange} />

      {showAdd && (
        <AddColorModal
          projectId={projectId}
          onClose={() => setShowAdd(false)}
          onCreated={(color) => {
            setColors((prev) => [...prev, color]);
            setShowAdd(false);
            onCountChange && onCountChange(1);
          }}
        />
      )}
    </div>
  );
}
