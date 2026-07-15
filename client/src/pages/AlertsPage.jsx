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

  if (loading) return <div className="page"><div className="loading-state">Loading…</div></div>;

  return (
    <div className="page">
      <h1>Alerts</h1>
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
