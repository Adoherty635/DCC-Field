import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import Chip from './Chip.jsx';

const ACCEPT = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].join(',');

function formatWhen(iso) {
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fileIcon(mime) {
  if (mime === 'application/pdf') return '📕';
  if (mime && mime.includes('word')) return '📘';
  if (mime && (mime.includes('excel') || mime.includes('spreadsheet'))) return '📗';
  return '📄';
}

export default function DocumentGrid({ projectId, category, isAdmin, itemLabel = 'file' }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState(null);
  const fileInput = useRef(null);

  const load = async () => {
    const rows = await api.get(`/projects/${projectId}/documents?category=${category}`);
    setDocs(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId, category]);

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('category', category);
      for (const f of files) formData.append('files', f);
      await api.post(`/projects/${projectId}/documents`, formData);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const remove = async (docId) => {
    if (!confirm(`Delete this ${itemLabel}?`)) return;
    await api.delete(`/projects/${projectId}/documents/${docId}`);
    setSelected(null);
    load();
  };

  if (loading) return <div className="loading-state">Loading…</div>;

  return (
    <div>
      {isAdmin && (
        <label className="upload-btn" style={{ marginBottom: 12 }}>
          {uploading ? 'Uploading…' : `📎 Add ${itemLabel}s`}
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            multiple
            onChange={onFiles}
            disabled={uploading}
          />
        </label>
      )}

      {docs.length === 0 ? (
        <div className="empty-state">No {itemLabel}s yet.</div>
      ) : (
        <div className="photo-grid">
          {docs.map((d) => {
            const isImage = d.mime && d.mime.startsWith('image/');
            return (
              <div key={d.id} style={{ position: 'relative' }}>
                {isImage ? (
                  <button className="photo-thumb" onClick={() => setSelected(d)}>
                    <img src={`/api/documents/${d.id}/thumb`} alt="" loading="lazy" />
                    <div className="photo-meta-overlay">{d.author_short_name}</div>
                  </button>
                ) : (
                  <a
                    className="photo-thumb doc-file-tile"
                    href={`/api/documents/${d.id}/full`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="doc-file-icon">{fileIcon(d.mime)}</span>
                    <span className="doc-file-name">{d.original_name || 'Document'}</span>
                    <div className="photo-meta-overlay">{d.author_short_name}</div>
                  </a>
                )}
                {isAdmin && (
                  <button
                    className="doc-delete-btn"
                    aria-label={`Delete ${d.original_name || itemLabel}`}
                    onClick={() => remove(d.id)}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="lightbox" onClick={() => setSelected(null)}>
          <button className="close-btn" onClick={() => setSelected(null)}>×</button>
          <img src={`/api/documents/${selected.id}/full`} alt="" onClick={(e) => e.stopPropagation()} />
          <div className="lightbox-meta" onClick={(e) => e.stopPropagation()}>
            <Chip color={selected.author_chip_color} label={selected.author_short_name} />
            {' '}{formatWhen(selected.created_at)}
          </div>
          {isAdmin && (
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
