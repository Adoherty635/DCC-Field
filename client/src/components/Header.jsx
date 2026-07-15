import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { api } from '../api/client.js';

export default function Header() {
  const { user, logout } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await api.get('/notifications/unread-count');
        if (!cancelled) setUnread(data.count);
      } catch {
        // ignore
      }
    };
    poll();
    const interval = setInterval(poll, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <div className="app-header">
        <a className="wordmark" href="/">DCC FIELD</a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NavLink to="/alerts" className="bell-btn" aria-label="Alerts">
            🔔
            {unread > 0 && <span className="bell-badge">{unread > 99 ? '99+' : unread}</span>}
          </NavLink>
          <button className="logout-btn" onClick={logout}>Log out</button>
        </div>
      </div>
      <div className="header-nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>Projects</NavLink>
        <NavLink to="/calendar" className={({ isActive }) => (isActive ? 'active' : '')}>Calendar</NavLink>
        {user.role === 'admin' && (
          <NavLink to="/team" className={({ isActive }) => (isActive ? 'active' : '')}>Team</NavLink>
        )}
      </div>
    </>
  );
}
