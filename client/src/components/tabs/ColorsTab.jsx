import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import Modal from '../Modal.jsx';
import DocumentGrid from '../DocumentGrid.jsx';
import ColorSwatchPicker from '../ColorSwatchPicker.jsx';

const CATALOG_MANUFACTURERS = ['Sherwin-Williams'];

function ColorFormModal({ projectId, color, onClose, onSaved }) {
  const [manufacturerChoice, setManufacturerChoice] = useState(() => {
    if (color?.manufacturer && CATALOG_MANUFACTURERS.includes(color.manufacturer)) return color.manufacturer;
    return color?.manufacturer ? 'Other' : CATALOG_MANUFACTURERS[0];
  });
  const [customManufacturer, setCustomManufacturer] = useState(
    color?.manufacturer && !CATALOG_MANUFACTURERS.includes(color.manufacturer) ? color.manufacturer : ''
  );
  const [form, setForm] = useState({
    name: color?.name || '',
    code: color?.code || '',
    hex: color?.hex || '#c7791b',
    product: color?.product || '',
    sheen: color?.sheen || '',
    location_note: color?.location_note || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isCatalog = CATALOG_MANUFACTURERS.includes(manufacturerChoice);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (isCatalog && !form.code) {
      setError('Search for and select a color first.');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...form,
        manufacturer: manufacturerChoice === 'Other' ? customManufacturer : manufacturerChoice,
      };
      const saved = color
        ? await api.patch(`/projects/${projectId}/colors/${color.id}`, payload)
        : await api.post(`/projects/${projectId}/colors`, payload);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2 style={{ marginTop: 0 }}>{color ? 'Edit color' : 'Add color'}</h2>
      <form onSubmit={submit}>
        <div className="field">
          <label>Manufacturer</label>
          <select
            value={manufacturerChoice}
            onChange={(e) => { setManufacturerChoice(e.target.value); setForm({ ...form, name: '', code: '', hex: '#c7791b' }); }}
          >
            {CATALOG_MANUFACTURERS.map((m) => <option key={m} value={m}>{m}</option>)}
            <option value="Other">Other</option>
          </select>
        </div>

        {manufacturerChoice === 'Other' && (
          <div className="field">
            <label>Manufacturer name</label>
            <input value={customManufacturer} onChange={(e) => setCustomManufacturer(e.target.value)} placeholder="e.g. Behr" />
          </div>
        )}

        {isCatalog ? (
          <ColorSwatchPicker
            manufacturer={manufacturerChoice}
            value={form.code ? { code: form.code, name: form.name, hex: form.hex } : null}
            onSelect={(c) => setForm({ ...form, name: c.name, code: c.code, hex: c.hex })}
          />
        ) : (
          <>
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
          </>
        )}

        <div className="field">
          <label>Product</label>
          <input value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder="e.g. Duration Exterior" />
        </div>
        <div className="field">
          <label>Sheen</label>
          <input value={form.sheen} onChange={(e) => setForm({ ...form, sheen: e.target.value })} placeholder="e.g. Eggshell" />
        </div>
        <div className="field">
          <label>Location / use</label>
          <input value={form.location_note} onChange={(e) => setForm({ ...form, location_note: e.target.value })} placeholder="e.g. Body, Accent, Trim" />
        </div>
        {error && <div className="login-error" style={{ color: '#b3261e' }}>{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : color ? 'Save' : 'Add'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function ColorsTab({ projectId, isAdmin, onCountChange }) {
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingColor, setEditingColor] = useState(null);

  useEffect(() => {
    api.get(`/projects/${projectId}/colors`).then((rows) => { setColors(rows); setLoading(false); });
  }, [projectId]);

  const remove = async (colorId) => {
    if (!confirm('Delete this color?')) return;
    await api.delete(`/projects/${projectId}/colors/${colorId}`);
    setColors((prev) => prev.filter((c) => c.id !== colorId));
    onCountChange && onCountChange(-1);
  };

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
              <div style={{ flex: 1 }}>
                <div className="name">{c.name || c.code}</div>
                <div className="sub">{[c.manufacturer, c.code].filter(Boolean).join(' · ')}</div>
                {c.product && <div className="sub">{c.product}</div>}
                <div className="sub">{c.sheen}</div>
                {c.location_note && <div className="sub">{c.location_note}</div>}
                {isAdmin && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="card-edit-btn" onClick={() => setEditingColor(c)}>Edit</button>
                    <button className="card-edit-btn" onClick={() => remove(c.id)}>Delete</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ marginTop: 24 }}>Renderings</h3>
      <DocumentGrid projectId={projectId} category="rendering" isAdmin={isAdmin} itemLabel="rendering" />

      {showAdd && (
        <ColorFormModal
          projectId={projectId}
          onClose={() => setShowAdd(false)}
          onSaved={(color) => {
            setColors((prev) => [...prev, color]);
            setShowAdd(false);
            onCountChange && onCountChange(1);
          }}
        />
      )}

      {editingColor && (
        <ColorFormModal
          projectId={projectId}
          color={editingColor}
          onClose={() => setEditingColor(null)}
          onSaved={(updated) => {
            setColors((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            setEditingColor(null);
          }}
        />
      )}
    </div>
  );
}
