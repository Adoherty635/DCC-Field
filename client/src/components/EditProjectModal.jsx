import React, { useState } from 'react';
import { api } from '../api/client.js';
import Modal from './Modal.jsx';

export default function EditProjectModal({ project, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState({
    name: project.name || '',
    client: project.client || '',
    address: project.address || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteTyped, setDeleteTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await api.patch(`/projects/${project.id}`, form);
      onSaved(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/projects/${project.id}`);
      onDeleted(project.id);
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2 style={{ marginTop: 0 }}>Edit project</h2>
      <form onSubmit={submit}>
        <div className="field">
          <label>Name</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label>Client</label>
          <input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
        </div>
        <div className="field">
          <label>Address</label>
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        {error && <div className="login-error" style={{ color: '#b3261e' }}>{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        {!confirmingDelete ? (
          <button className="btn btn-danger" onClick={() => setConfirmingDelete(true)}>
            Delete this project
          </button>
        ) : (
          <div>
            <p style={{ marginTop: 0, fontSize: '0.9rem' }}>
              This permanently deletes <strong>{project.name}</strong> — its scope, photos, notes,
              colors, orders, receipts, and calendar events. This cannot be undone. Type the
              project name to confirm.
            </p>
            <div className="field">
              <input
                value={deleteTyped}
                onChange={(e) => setDeleteTyped(e.target.value)}
                placeholder={project.name}
              />
            </div>
            {deleteError && <div className="login-error" style={{ color: '#b3261e' }}>{deleteError}</div>}
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setConfirmingDelete(false); setDeleteTyped(''); setDeleteError(''); }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={deleteTyped !== project.name || deleting}
                onClick={doDelete}
              >
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
