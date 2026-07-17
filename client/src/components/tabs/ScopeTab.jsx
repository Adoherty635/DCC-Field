import React, { useState } from 'react';
import { api } from '../../api/client.js';
import DocumentGrid from '../DocumentGrid.jsx';

export default function ScopeTab({ project, isAdmin, onUpdated }) {
  const [spanish, setSpanish] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.scope);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.patch(`/projects/${project.id}`, { scope: draft });
      onUpdated(updated);
      setEditing(false);
      setSpanish(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const text = spanish ? project.scope_es : project.scope;
  const spanishUnavailable = spanish && project.scope && !project.scope_es;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <button className={`toggle-es ${spanish ? 'active' : ''}`} onClick={() => setSpanish((v) => !v)}>
          🌐 Español
        </button>
        {isAdmin && !editing && (
          <button className="btn btn-secondary" onClick={() => { setDraft(project.scope); setEditing(true); }}>
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <>
          <textarea className="scope-editor" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>
      ) : spanishUnavailable ? (
        <div className="empty-state">Translation unavailable.</div>
      ) : text ? (
        <div className="scope-text">{text}</div>
      ) : (
        <div className="empty-state">No scope of work yet.</div>
      )}

      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <h3 style={{ marginTop: 0 }}>Attachments</h3>
        <DocumentGrid projectId={project.id} category="scope" isAdmin={isAdmin} itemLabel="document" />
      </div>
    </div>
  );
}
