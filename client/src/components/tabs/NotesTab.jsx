import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import Chip from '../Chip.jsx';

function formatWhen(iso) {
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function NoteItem({ note, projectId, onTranslated }) {
  const [showEs, setShowEs] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

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

  return (
    <div className="note-item">
      <div className="note-head">
        <Chip color={note.author_chip_color} label={note.author_short_name} />
        <span className="timestamp">{formatWhen(note.created_at)}</span>
      </div>
      <div className="note-body">{showEs ? note.body_es : note.body}</div>
      <button className={`toggle-es ${showEs ? 'active' : ''}`} style={{ marginTop: 8 }} onClick={toggle} disabled={loading}>
        {loading ? 'Translating…' : '🌐 Español'}
      </button>
      {error && <span className="login-error" style={{ marginLeft: 8 }}>Translation unavailable</span>}
    </div>
  );
}

export default function NotesTab({ projectId, onCountChange }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
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
      const note = await api.post(`/projects/${projectId}/notes`, { body });
      setNotes((prev) => [...prev, note]);
      setBody('');
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

  if (loading) return <div className="loading-state">Loading…</div>;

  return (
    <div>
      {notes.length === 0 ? (
        <div className="empty-state">No notes yet.</div>
      ) : (
        <div className="note-thread">
          {notes.map((n) => (
            <NoteItem key={n.id} note={n} projectId={projectId} onTranslated={onTranslated} />
          ))}
        </div>
      )}
      <form className="note-compose" onSubmit={post}>
        <textarea
          placeholder="Write a note…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={posting}>Post</button>
      </form>
    </div>
  );
}
