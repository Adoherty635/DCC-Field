import React, { useEffect, useRef, useState } from 'react';

const CATALOG_URLS = {
  'Sherwin-Williams': '/color-catalogs/sherwin-williams.json',
  'Benjamin Moore': '/color-catalogs/benjamin-moore.json',
};

const catalogCache = {};

export default function ColorSwatchPicker({ manufacturer, value, onSelect }) {
  const [catalog, setCatalog] = useState(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const url = CATALOG_URLS[manufacturer];
    if (!url) return;
    if (catalogCache[manufacturer]) {
      setCatalog(catalogCache[manufacturer]);
      return;
    }
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        catalogCache[manufacturer] = data;
        setCatalog(data);
      })
      .catch(() => setCatalog([]));
  }, [manufacturer]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (!catalog) return <div className="loading-state" style={{ padding: '8px 0' }}>Loading color list…</div>;

  const q = query.trim().toLowerCase();
  const matches = q
    ? catalog.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)).slice(0, 30)
    : [];

  return (
    <div className="field" ref={boxRef} style={{ position: 'relative' }}>
      <label>Color</label>

      {value?.code && !open ? (
        <div className="swatch-picker-selected" onClick={() => setOpen(true)}>
          <span className="color-swatch" style={{ width: 28, height: 28, background: value.hex }} />
          <span>{value.name} ({value.code})</span>
          <button type="button" className="card-edit-btn" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
            Change
          </button>
        </div>
      ) : (
        <input
          autoFocus={open}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search by name or color number…"
        />
      )}

      {open && q && (
        <div className="swatch-picker-results">
          {matches.length === 0 ? (
            <div className="swatch-picker-empty">No matches.</div>
          ) : (
            matches.map((c) => (
              <button
                type="button"
                key={c.code}
                className="swatch-picker-row"
                onClick={() => {
                  onSelect(c);
                  setQuery('');
                  setOpen(false);
                }}
              >
                <span className="color-swatch" style={{ width: 22, height: 22, background: c.hex }} />
                <span>{c.name}</span>
                <span className="sub">{c.code}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
