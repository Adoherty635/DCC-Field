import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { api } from '../api/client.js';
import Chip from '../components/Chip.jsx';
import ScopeTab from '../components/tabs/ScopeTab.jsx';
import PicturesTab from '../components/tabs/PicturesTab.jsx';
import NotesTab from '../components/tabs/NotesTab.jsx';
import ColorsTab from '../components/tabs/ColorsTab.jsx';
import OrdersTab from '../components/tabs/OrdersTab.jsx';
import ReceiptsTab from '../components/tabs/ReceiptsTab.jsx';

const TABS = [
  { key: 'scope', label: 'Scope', icon: '📋' },
  { key: 'pictures', label: 'Pictures', icon: '📷', countKey: 'pictures' },
  { key: 'notes', label: 'Notes', icon: '💬', countKey: 'notes' },
  { key: 'colors', label: 'Colors', icon: '🎨', countKey: 'colors' },
  { key: 'orders', label: 'Orders', icon: '📦', countKey: 'orders' },
  { key: 'receipts', label: 'Receipts', icon: '🧾', countKey: 'receipts' },
];

function statusClass(status) {
  return `status-pill status-${status.replace(/\s+/g, '-')}`;
}

export default function ProjectDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState('scope');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await api.get(`/projects/${id}`);
      setProject(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const bumpCount = (key, delta) => {
    setProject((prev) => ({ ...prev, counts: { ...prev.counts, [key]: Math.max(0, prev.counts[key] + delta) } }));
  };

  if (loading) return <div className="page"><div className="loading-state">Loading…</div></div>;
  if (error || !project) return <div className="page"><div className="empty-state">{error || 'Project not found'}</div></div>;

  const isAdmin = user.role === 'admin';

  const renderTab = () => {
    switch (tab) {
      case 'scope': return <ScopeTab project={project} isAdmin={isAdmin} onUpdated={setProject} />;
      case 'pictures': return <PicturesTab projectId={project.id} isAdmin={isAdmin} onCountChange={(d) => bumpCount('pictures', d)} />;
      case 'notes': return <NotesTab projectId={project.id} onCountChange={(d) => bumpCount('notes', d)} />;
      case 'colors': return <ColorsTab projectId={project.id} isAdmin={isAdmin} onCountChange={(d) => bumpCount('colors', d)} onPictureCountChange={(d) => bumpCount('pictures', d)} />;
      case 'orders': return <OrdersTab projectId={project.id} isAdmin={isAdmin} onCountChange={(d) => bumpCount('orders', d)} />;
      case 'receipts': return <ReceiptsTab projectId={project.id} isAdmin={isAdmin} onCountChange={(d) => bumpCount('receipts', d)} />;
      default: return null;
    }
  };

  const TabButton = ({ t }) => (
    <button className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
      <span>{t.icon} {t.label}</span>
      {t.countKey && <span className="badge">{project.counts[t.countKey]}</span>}
    </button>
  );

  return (
    <div className="page">
      <div className="project-header" style={{ borderLeft: `6px solid ${project.crew.chip_color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h1>{project.name}</h1>
            <p className="meta">{project.client}{project.client && project.address ? ' · ' : ''}{project.address}</p>
          </div>
          <span className={statusClass(project.status)}>{project.status}</span>
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          <Chip color={project.crew.chip_color} label={project.crew.short_name} />
          {isAdmin && (
            <select
              value={project.status}
              onChange={async (e) => {
                const updated = await api.patch(`/projects/${project.id}`, { status: e.target.value });
                setProject(updated);
              }}
            >
              <option>Scheduled</option>
              <option>In progress</option>
              <option>Complete</option>
            </select>
          )}
        </div>
      </div>

      <div className="detail-layout">
        <div className="tab-rail">
          {TABS.map((t) => <TabButton key={t.key} t={t} />)}
        </div>
        <div className="detail-main">
          <div className="tab-pills">
            {TABS.map((t) => <TabButton key={t.key} t={t} />)}
          </div>
          {renderTab()}
        </div>
      </div>
    </div>
  );
}
