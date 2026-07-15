import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import Chip from './Chip.jsx';

function formatWhen(iso) {
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function PhotoGrid({ projectId, kind, canUpload, canDelete, onCountChange }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState(null);
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
      for (const f of files) formData.append('files', f);
      await api.post(`/projects/${projectId}/photos`, formData);
      await load();
      onCountChange && onCountChange(files.length);
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

  if (loading) return <div className="loading-state">Loading…</div>;

  return (
    <div>
      {canUpload && (
        <label className="upload-btn" style={{ marginBottom: 12 }}>
          {uploading ? 'Uploading…' : '📷 Add photos'}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={onFiles}
            disabled={uploading}
          />
        </label>
      )}

      {photos.length === 0 ? (
        <div className="empty-state">No photos yet.</div>
      ) : (
        <div className="photo-grid">
          {photos.map((p) => (
            <button key={p.id} className="photo-thumb" onClick={() => setSelected(p)}>
              <img src={`/api/media/${p.id}/thumb`} alt="" loading="lazy" />
              <div className="photo-meta-overlay">{p.author_short_name}</div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="lightbox" onClick={() => setSelected(null)}>
          <button className="close-btn" onClick={() => setSelected(null)}>×</button>
          <img src={`/api/media/${selected.id}/full`} alt="" onClick={(e) => e.stopPropagation()} />
          <div className="lightbox-meta" onClick={(e) => e.stopPropagation()}>
            <Chip color={selected.author_chip_color} label={selected.author_short_name} />
            {' '}{formatWhen(selected.created_at)}
          </div>
          {canDelete && (
            <button
              className="btn btn-danger"
              style={{ marginTop: 12 }}
              onClick={(e) => { e.stopPropagation(); remove(selected.id); }}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
