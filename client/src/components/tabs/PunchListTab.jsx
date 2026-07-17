import React, { useState } from 'react';
import { api } from '../../api/client.js';
import DocumentGrid from '../DocumentGrid.jsx';

export default function PunchListTab({ project, isAdmin, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.punch_list || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.patch(`/projects/${project.id}/punch-list`, { punch_list: draft });
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Punch list</h3>
        {!editing && (
          <button className="btn btn-secondary" onClick={() => { setDraft(project.punch_list || ''); setEditing(true); }}>
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <>
          <textarea
            className="scope-editor"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Touch up trim in room 204, re-caulk lobby windows, replace stained ceiling tile…"
          />
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>
      ) : project.punch_list ? (
        <div className="scope-text">{project.punch_list}</div>
      ) : (
        <div className="empty-state">No punch list items yet.</div>
      )}

      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <h3 style={{ marginTop: 0 }}>Attachments</h3>
        <DocumentGrid
          projectId={project.id}
          category="punch_list"
          isAdmin={isAdmin}
          canUpload
          itemLabel="attachment"
        />
      </div>
    </div>
  );
}
