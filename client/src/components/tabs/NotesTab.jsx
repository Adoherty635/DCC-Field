import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import Chip from '../Chip.jsx';

function formatWhen(iso) {
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function NoteItem({ note, projectId, isAdmin, onTranslated, onUpdated, onDeleted }) {
  const [showEs, setShowEs] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftBody, setDraftBody] = useState(note.body);
  const [draftVisibility, setDraftVisibility] = useState(note.visibility);
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    if (showEs) { setShowEs(false); return; }
    if (note.body_es) { setShowEs(true); return; }
    setLoading(true);
    setError(false);
    try {
      const data = await api.post(`/projects/${projectId}/notes/${note.id}/translate`);
      onTranslated(note.id, data.body_es);
      setShowEs(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = () => {
    setDraftBody(note.body);
    setDraftVisibility(note.visibility);
    setEditing(true);
  };

  const save = async () => {
    if (!draftBody.trim()) return;
    setSaving(true);
    try {
      const updated = await api.patch(`/projects/${projectId}/notes/${note.id}`, {
        body: draftBody,
        visibility: draftVisibility,
      });
      onUpdated(updated);
      setShowEs(false);
      setEditing(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm('Delete this note?')) return;
    await api.delete(`/projects/${projectId}/notes/${note.id}`);
    onDeleted(note.id);
  };

  return (
    <div className="note-item">
      <div className="note-head">
        <Chip color={note.author_chip_color} label={note.author_short_name} />
        <span className="timestamp">{formatWhen(note.created_at)}</span>
        {note.visibility === 'admin' && <span className="badge">Admin only</span>}
      </div>

      {editing ? (
        <>
          {isAdmin && (
            <div className="field" style={{ marginTop: 8, marginBottom: 8, maxWidth: 200 }}>
              <label>Visible to</label>
              <select value={draftVisibility} onChange={(e) => setDraftVisibility(e.target.value)}>
                <option value="everyone">Everyone</option>
                <option value="admin">Admin only</option>
              </select>
            </div>
          )}
          <textarea
            className="scope-editor"
            style={{ minHeight: 80 }}
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
          />
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="note-body">{showEs ? note.body_es : note.body}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className={`toggle-es ${showEs ? 'active' : ''}`} onClick={toggle} disabled={loading}>
              {loading ? 'Translating…' : '🌐 Español'}
            </button>
            <button className="card-edit-btn" onClick={startEdit}>Edit</button>
            {isAdmin && <button className="card-edit-btn" onClick={remove}>Delete</button>}
            {error && <span className="login-error">Translation unavailable</span>}
          </div>
        </>
      )}
    </div>
  );
}

export default function NotesTab({ projectId, isAdmin, onCountChange }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState('everyone');
  const [posting, setPosting] = useState(false);

  const load = async () => {
    const rows = await api.get(`/projects/${projectId}/notes`);
    setNotes(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const post = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    try {
      const note = await api.post(`/projects/${projectId}/notes`, { body, visibility });
      setNotes((prev) => [...prev, note]);
      setBody('');
      setVisibility('everyone');
      onCountChange && onCountChange(1);
    } catch (err) {
      alert(err.message);
    } finally {
      setPosting(false);
    }
  };

  const onTranslated = (noteId, body_es) => {
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, body_es } : n)));
  };

  const onUpdated = (updated) => {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  };

  const onDeleted = (noteId) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    onCountChange && onCountChange(-1);
  };

  if (loading) return <div className="loading-state">Loading…</div>;

  return (
    <div>
      {notes.length === 0 ? (
        <div className="empty-state">No notes yet.</div>
      ) : (
        <div className="note-thread">
          {notes.map((n) => (
            <NoteItem
              key={n.id}
              note={n}
              projectId={projectId}
              isAdmin={isAdmin}
              onTranslated={onTranslated}
              onUpdated={onUpdated}
              onDeleted={onDeleted}
            />
          ))}
        </div>
      )}
      <form onSubmit={post}>
        {isAdmin && (
          <div className="field" style={{ marginTop: 14, marginBottom: 8, maxWidth: 200 }}>
            <label>Visible to</label>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
              <option value="everyone">Everyone</option>
              <option value="admin">Admin only</option>
            </select>
          </div>
        )}
        <div className="note-compose" style={{ marginTop: isAdmin ? 0 : 14 }}>
          <textarea
            placeholder="Write a note…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={posting}>Post</button>
        </div>
      </form>
    </div>
  );
}
