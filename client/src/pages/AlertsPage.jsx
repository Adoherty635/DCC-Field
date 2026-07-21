import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

function formatWhen(iso) {
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/notifications').then((rows) => { setAlerts(rows); setLoading(false); });
  }, []);

  const markRead = async (id) => {
    await api.post(`/notifications/${id}/read`);
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: 1 } : a)));
  };

  const clearOne = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    await api.delete(`/notifications/${id}`);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const clearAll = async () => {
    if (!confirm('Clear all alerts?')) return;
    await api.delete('/notifications');
    setAlerts([]);
  };

  if (loading) return <div className="page"><div className="loading-state">Loading…</div></div>;

  return (
    <div className="page">
      <div className="page-title-row">
        <h1>Alerts</h1>
        {alerts.length > 0 && (
          <button className="btn btn-secondary" onClick={clearAll}>Clear all</button>
        )}
      </div>
      {alerts.length === 0 ? (
        <div className="empty-state">No alerts yet.</div>
      ) : (
        alerts.map((a) => {
          const content = (
            <>
              {!a.read && <span className="unread-dot" />}
              <div className="alert-body">
                <div>{a.body}</div>
                <div className="alert-time">{formatWhen(a.created_at)}</div>
                {a.sms_sent ? <span className="sent-badge">Text sent</span> : null}
              </div>
              <button
                className="alert-clear-btn"
                aria-label="Clear alert"
                onClick={(e) => clearOne(e, a.id)}
              >
                ×
              </button>
            </>
          );
          return a.project_id ? (
            <Link
              key={a.id}
              to={`/p/${a.project_id}`}
              className={`alert-item ${a.read ? '' : 'unread'}`}
              onClick={() => !a.read && markRead(a.id)}
            >
              {content}
            </Link>
          ) : (
            <div
              key={a.id}
              className={`alert-item ${a.read ? '' : 'unread'}`}
              onClick={() => !a.read && markRead(a.id)}
            >
              {content}
            </div>
          );
        })
      )}
    </div>
  );
}
