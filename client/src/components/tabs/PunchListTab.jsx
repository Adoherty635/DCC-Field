import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client.js';
import Chip from '../Chip.jsx';
import DocumentGrid from '../DocumentGrid.jsx';

function formatWhen(iso) {
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function PunchItemRow({ item, projectId, isAdmin, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [draftDescription, setDraftDescription] = useState(item.description);
  const [draftFile, setDraftFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraftDescription(item.description);
    setDraftFile(null);
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('description', draftDescription);
      if (draftFile) formData.append('photo', draftFile);
      const updated = await api.patch(`/projects/${projectId}/punch-items/${item.id}`, formData);
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm('Delete this punch list item?')) return;
    await api.delete(`/projects/${projectId}/punch-items/${item.id}`);
    onDeleted(item.id);
  };

  return (
    <div className="punch-item">
      <div className="punch-item-photo">
        {item.thumb_path ? (
          <img src={`/api/projects/${projectId}/punch-items/${item.id}/photo/thumb`} alt="" />
        ) : item.file_path ? (
          <img src={`/api/projects/${projectId}/punch-items/${item.id}/photo`} alt="" />
        ) : (
          <div className="punch-item-photo-placeholder">📷</div>
        )}
      </div>

      <div className="punch-item-body">
        {editing ? (
          <>
            <textarea
              className="scope-editor"
              style={{ minHeight: 60 }}
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              placeholder="Location / description…"
            />
            <label className="toggle-es" style={{ display: 'inline-block', marginTop: 6, cursor: 'pointer' }}>
              {draftFile ? draftFile.name : '📷 Replace photo'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={(e) => setDraftFile(e.target.files[0] || null)}
              />
            </label>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="punch-item-desc">{item.description || <em>No description</em>}</div>
            <div className="punch-item-meta">
              <Chip color={item.author_chip_color} label={item.author_short_name} />
              <span>{formatWhen(item.created_at)}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button className="card-edit-btn" onClick={startEdit}>Edit</button>
              {isAdmin && <button className="card-edit-btn" onClick={remove}>Delete</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AddPunchItem({ projectId, onAdded }) {
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [posting, setPosting] = useState(false);
  const fileInput = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!description.trim() && !file) return;
    setPosting(true);
    try {
      const formData = new FormData();
      if (description.trim()) formData.append('description', description.trim());
      if (file) formData.append('photo', file);
      const item = await api.post(`/projects/${projectId}/punch-items`, formData);
      onAdded(item);
      setDescription('');
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
    } catch (err) {
      alert(err.message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <form onSubmit={submit} className="punch-add-form">
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe the item and its location (e.g. Touch up trim, room 204)…"
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
        <label className="upload-btn">
          {file ? file.name : '📷 Add photo'}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setFile(e.target.files[0] || null)}
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={posting}>
          {posting ? 'Adding…' : 'Add item'}
        </button>
      </div>
    </form>
  );
}

export default function PunchListTab({ project, isAdmin, onUpdated }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(project.punch_list || '');
  const [savingNotes, setSavingNotes] = useState(false);

  const load = async () => {
    const rows = await api.get(`/projects/${project.id}/punch-items`);
    setItems(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, [project.id]);

  const onAdded = (item) => setItems((prev) => [...prev, item]);
  const onItemUpdated = (updated) => setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  const onItemDeleted = (id) => setItems((prev) => prev.filter((i) => i.id !== id));

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      const updated = await api.patch(`/projects/${project.id}/punch-list`, { punch_list: notesDraft });
      onUpdated(updated);
      setEditingNotes(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Punch list</h3>
        {items.length > 0 && (
          <a className="btn btn-secondary" href={`/api/projects/${project.id}/punch-items/pdf`}>
            Download PDF
          </a>
        )}
      </div>

      {loading ? (
        <div className="loading-state">Loading…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No punch list items yet.</div>
      ) : (
        <div className="punch-list">
          {items.map((item) => (
            <PunchItemRow
              key={item.id}
              item={item}
              projectId={project.id}
              isAdmin={isAdmin}
              onUpdated={onItemUpdated}
              onDeleted={onItemDeleted}
            />
          ))}
        </div>
      )}

      <AddPunchItem projectId={project.id} onAdded={onAdded} />

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Additional notes</h3>
          {!editingNotes && (
            <button
              className="btn btn-secondary"
              onClick={() => { setNotesDraft(project.punch_list || ''); setEditingNotes(true); }}
            >
              Edit
            </button>
          )}
        </div>

        {editingNotes ? (
          <>
            <textarea
              className="scope-editor"
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="General notes for this punch list…"
            />
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEditingNotes(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveNotes} disabled={savingNotes}>
                {savingNotes ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        ) : project.punch_list ? (
          <div className="scope-text">{project.punch_list}</div>
        ) : (
          <div className="empty-state">No additional notes.</div>
        )}
      </div>

      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <h3 style={{ marginTop: 0 }}>Attachments</h3>
        <DocumentGrid projectId={project.id} category="punch_list" isAdmin={isAdmin} canUpload itemLabel="attachment" />
      </div>
    </div>
  );
}
