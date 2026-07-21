import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import Chip from './Chip.jsx';

function formatWhen(iso) {
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const ACCEPT = 'image/*,video/mp4,video/quicktime,video/webm';

export default function PhotoGrid({ projectId, kind, canUpload, canDelete, onCountChange }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');
  const fileInput = useRef(null);

  const load = async () => {
    const rows = await api.get(`/projects/${projectId}/photos?kind=${kind}`);
    setPhotos(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId, kind]);

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('kind', kind);
      if (noteDraft.trim()) formData.append('caption', noteDraft.trim());
      for (const f of files) formData.append('files', f);
      await api.post(`/projects/${projectId}/photos`, formData);
      await load();
      onCountChange && onCountChange(files.length);
      setNoteDraft('');
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const remove = async (photoId) => {
    if (!confirm('Delete this photo?')) return;
    await api.delete(`/projects/${projectId}/photos/${photoId}`);
    setSelected(null);
    load();
    onCountChange && onCountChange(-1);
  };

  const saveCaption = async () => {
    const updated = await api.patch(`/projects/${projectId}/photos/${selected.id}`, { caption: captionDraft });
    setSelected(updated);
    setPhotos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setEditingCaption(false);
  };

  if (loading) return <div className="loading-state">Loading…</div>;

  return (
    <div>
      {canUpload && (
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Add a note for these photos (optional)"
            style={{
              width: '100%', marginBottom: 8, border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '10px 12px', minHeight: 'var(--tap)',
            }}
          />
          <label className="upload-btn">
            {uploading ? 'Uploading…' : '📷 Add photos or video'}
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPT}
              multiple
              capture="environment"
              onChange={onFiles}
              disabled={uploading}
            />
          </label>
        </div>
      )}

      {photos.length === 0 ? (
        <div className="empty-state">No photos yet.</div>
      ) : (
        <div className="photo-grid">
          {photos.map((p) => (
            <button
              key={p.id}
              className={p.media_type === 'video' ? 'photo-thumb doc-file-tile' : 'photo-thumb'}
              onClick={() => { setSelected(p); setEditingCaption(false); setCaptionDraft(p.caption || ''); }}
            >
              {p.media_type === 'video' ? (
                <span className="doc-file-icon">🎬</span>
              ) : (
                <img src={`/api/media/${p.id}/thumb`} alt="" loading="lazy" />
              )}
              <div className="photo-meta-overlay">{p.author_short_name}</div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="lightbox" onClick={() => setSelected(null)}>
          <button className="close-btn" onClick={() => setSelected(null)}>×</button>
          {selected.media_type === 'video' ? (
            <video
              src={`/api/media/${selected.id}/full`}
              controls
              style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 8 }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img src={`/api/media/${selected.id}/full`} alt="" onClick={(e) => e.stopPropagation()} />
          )}
          <div className="lightbox-meta" onClick={(e) => e.stopPropagation()}>
            <Chip color={selected.author_chip_color} label={selected.author_short_name} />
            {' '}{formatWhen(selected.created_at)}

            {editingCaption ? (
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <input
                  autoFocus
                  value={captionDraft}
                  onChange={(e) => setCaptionDraft(e.target.value)}
                  placeholder="Add a note…"
                  style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}
                />
                <button className="btn btn-primary" onClick={saveCaption}>Save</button>
              </div>
            ) : (
              <div style={{ marginTop: 8 }}>
                {selected.caption && <div style={{ marginBottom: 6 }}>{selected.caption}</div>}
                {canDelete && (
                  <button className="toggle-es" onClick={() => setEditingCaption(true)}>
                    {selected.caption ? 'Edit note' : '+ Add note'}
                  </button>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 12 }} onClick={(e) => e.stopPropagation()}>
            <a className="btn btn-secondary" href={`/api/media/${selected.id}/full`} download>
              Download
            </a>
            {canDelete && (
              <button className="btn btn-danger" onClick={() => remove(selected.id)}>
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
