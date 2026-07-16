import React, { useRef, useState } from 'react';
import { api } from '../../api/client.js';

export default function ScopeTab({ project, isAdmin, onUpdated }) {
  const [spanish, setSpanish] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.scope);
  const [saving, setSaving] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInput = useRef(null);

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

  const attachDoc = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const updated = await api.post(`/projects/${project.id}/scope-doc`, formData);
      onUpdated(updated);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploadingDoc(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const removeDoc = async () => {
    if (!confirm('Remove the attached scope document?')) return;
    const updated = await api.delete(`/projects/${project.id}/scope-doc`);
    onUpdated(updated);
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
        {project.scope_doc_name ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <a
              className="btn btn-secondary"
              href={`/api/projects/${project.id}/scope-doc`}
              target="_blank"
              rel="noopener noreferrer"
            >
              📎 {project.scope_doc_name}
            </a>
            {isAdmin && (
              <button className="btn btn-danger" onClick={removeDoc}>Remove</button>
            )}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: 0, textAlign: 'left' }}>No document attached.</div>
        )}

        {isAdmin && (
          <label className="upload-btn" style={{ marginTop: 10 }}>
            {uploadingDoc ? 'Uploading…' : project.scope_doc_name ? '📎 Replace document' : '📎 Attach document'}
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
              onChange={attachDoc}
              disabled={uploadingDoc}
            />
          </label>
        )}
      </div>
    </div>
  );
}
