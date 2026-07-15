import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import Header from './components/Header.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import ProjectDetailPage from './pages/ProjectDetailPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import TeamPage from './pages/TeamPage.jsx';
import AlertsPage from './pages/AlertsPage.jsx';

function Shell() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-state">Loading…</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <div className="app-shell">
      <Header />
      <Routes>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/p/:id" element={<ProjectDetailPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        {user.role === 'admin' && <Route path="/team" element={<TeamPage />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
