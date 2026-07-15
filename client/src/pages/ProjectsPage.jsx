import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { api } from '../api/client.js';
import Chip from '../components/Chip.jsx';
import Modal from '../components/Modal.jsx';

function statusClass(status) {
  return `status-pill status-${status.replace(/\s+/g, '-')}`;
}

function ProjectCard({ project }) {
  return (
    <Link to={`/p/${project.id}`} className="project-card" style={{ borderLeftColor: project.crew.chip_color }}>
      <div className="row1">
        <div>
          <h3>{project.name}</h3>
          <p className="meta">{project.client}{project.client && project.address ? ' · ' : ''}{project.address}</p>
        </div>
        <span className={statusClass(project.status)}>{project.status}</span>
      </div>
      <Chip color={project.crew.chip_color} label={project.crew.short_name} />
      {project.next_event && (
        <p className="next-event">
          Next: {project.next_event.title} — {project.next_event.date} {project.next_event.time_label}
        </p>
      )}
    </Link>
  );
}

function NewProjectModal({ crews, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', client: '', address: '', crew_id: crews[0]?.id || '', scope: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const project = await api.post('/projects', form);
      onCreated(project);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2 style={{ marginTop: 0 }}>New project</h2>
      <form onSubmit={submit}>
        <div className="field">
          <label>Name</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label>Client</label>
          <input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
        </div>
        <div className="field">
          <label>Address</label>
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="field">
          <label>Crew</label>
          <select value={form.crew_id} onChange={(e) => setForm({ ...form, crew_id: e.target.value })}>
            {crews.map((c) => (
              <option key={c.id} value={c.id}>{c.display_name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Scope of work</label>
          <textarea value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} />
        </div>
        {error && <div className="login-error" style={{ color: '#b3261e' }}>{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [crews, setCrews] = useState([]);
  const [crewFilter, setCrewFilter] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const rows = await api.get('/projects');
    setProjects(rows);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (user.role === 'admin') {
      api.get('/team').then((rows) => setCrews(rows.filter((u) => u.role === 'crew')));
    }
  }, []);

  if (loading) return <div className="page"><div className="loading-state">Loading projects…</div></div>;

  const visible = crewFilter ? projects.filter((p) => p.crew_id === crewFilter) : projects;
  const active = visible.filter((p) => p.status !== 'Complete');
  const archived = visible.filter((p) => p.status === 'Complete');

  return (
    <div className="page">
      <div className="page-title-row">
        <h1>Projects</h1>
        {user.role === 'admin' && (
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New project</button>
        )}
      </div>

      {user.role === 'admin' && crews.length > 0 && (
        <div className="crew-filter">
          <button className={!crewFilter ? 'active' : ''} onClick={() => setCrewFilter(null)}>All crews</button>
          {crews.map((c) => (
            <button key={c.id} className={crewFilter === c.id ? 'active' : ''} onClick={() => setCrewFilter(c.id)}>
              {c.short_name}
            </button>
          ))}
        </div>
      )}

      {active.length === 0 ? (
        <div className="empty-state">No projects yet.</div>
      ) : (
        <div className="project-list">
          {active.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}

      {archived.length > 0 && (
        <>
          <button className="archived-toggle" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? '▾' : '▸'} Archived ({archived.length})
          </button>
          {showArchived && (
            <div className="project-list">
              {archived.map((p) => <ProjectCard key={p.id} project={p} />)}
            </div>
          )}
        </>
      )}

      {showNew && (
        <NewProjectModal
          crews={crews}
          onClose={() => setShowNew(false)}
          onCreated={(project) => {
            setShowNew(false);
            setProjects((prev) => [project, ...prev]);
          }}
        />
      )}
    </div>
  );
}
