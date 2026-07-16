import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { api } from '../api/client.js';
import Modal from '../components/Modal.jsx';
import { Dot } from '../components/Chip.jsx';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toMonthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function daysInGrid(year, month) {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function NewEventModal({ projects, onClose, onCreated }) {
  const [form, setForm] = useState({ project_id: projects[0]?.id || '', date: dateStr(new Date()), time_label: '', title: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const event = await api.post('/events', form);
      onCreated(event);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2 style={{ marginTop: 0 }}>New event</h2>
      <form onSubmit={submit}>
        <div className="field">
          <label>Project</label>
          <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.crew.short_name})</option>)}
          </select>
        </div>
        <div className="field">
          <label>Date</label>
          <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div className="field">
          <label>Time</label>
          <input placeholder="e.g. 6:00 AM" value={form.time_label} onChange={(e) => setForm({ ...form, time_label: e.target.value })} />
        </div>
        <div className="field">
          <label>Title</label>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        {error && <div className="login-error" style={{ color: '#b3261e' }}>{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Adding…' : 'Add'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function CalendarPage() {
  const { user } = useAuth();
  const [cursor, setCursor] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedDay, setSelectedDay] = useState(dateStr(new Date()));
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const rows = await api.get(`/events?month=${toMonthKey(cursor)}`);
    setEvents(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, [cursor]);
  useEffect(() => {
    // Scoped server-side per role — crews only ever get their own projects
    // back, admin gets all of them. This is what keeps each crew's bars
    // private to them on their own calendar.
    api.get('/projects').then(setProjects);
  }, []);

  const days = daysInGrid(cursor.getFullYear(), cursor.getMonth());
  const eventsByDay = {};
  for (const ev of events) {
    (eventsByDay[ev.date] = eventsByDay[ev.date] || []).push(ev);
  }
  const todayKey = dateStr(new Date());
  const selectedEvents = eventsByDay[selectedDay] || [];

  const rangedProjects = projects.filter((p) => p.start_date && p.end_date);
  const barsForDay = (dayKey) =>
    rangedProjects.filter((p) => p.start_date <= dayKey && dayKey <= p.end_date);

  // A start/end auto-event is redundant with the bar on days its project
  // already spans as a range — skip it so the cell isn't cluttered.
  const isBarCovered = (ev) => {
    if (!ev.auto_type) return false;
    const project = projects.find((p) => p.id === ev.project_id);
    return Boolean(project && project.start_date && project.end_date);
  };

  return (
    <div className="page">
      <div className="page-title-row">
        <h1>Calendar</h1>
        {user.role === 'admin' && (
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New event</button>
        )}
      </div>

      <div className="calendar-head">
        <button className="btn btn-secondary" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>‹ Prev</button>
        <strong>{cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</strong>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => { const n = new Date(); setCursor(n); setSelectedDay(dateStr(n)); }}>Today</button>
          <button className="btn btn-secondary" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>Next ›</button>
        </div>
      </div>

      {loading ? <div className="loading-state">Loading…</div> : (
        <>
          <div className="calendar-grid">
            {DOW.map((d) => <div key={d} className="calendar-dow">{d}</div>)}
            {days.map((d) => {
              const key = dateStr(d);
              const dayEvents = (eventsByDay[key] || []).filter((ev) => !isBarCovered(ev));
              const bars = barsForDay(key);
              const outOfMonth = d.getMonth() !== cursor.getMonth();
              return (
                <button
                  key={key}
                  className={`calendar-cell ${outOfMonth ? 'out-of-month' : ''} ${key === todayKey ? 'today' : ''}`}
                  onClick={() => setSelectedDay(key)}
                >
                  <span className="day-num">{d.getDate()}</span>
                  {bars.length > 0 && (
                    <span className="calendar-bars">
                      {bars.slice(0, 3).map((p) => {
                        const isStart = p.start_date === key;
                        const isEnd = p.end_date === key;
                        return (
                          <span
                            key={p.id}
                            className="calendar-bar-segment"
                            title={`${p.name} (${p.crew.short_name})`}
                            style={{
                              background: p.crew.chip_color,
                              borderTopLeftRadius: isStart ? 4 : 0,
                              borderBottomLeftRadius: isStart ? 4 : 0,
                              borderTopRightRadius: isEnd ? 4 : 0,
                              borderBottomRightRadius: isEnd ? 4 : 0,
                            }}
                          />
                        );
                      })}
                      {bars.length > 3 && <span className="calendar-bar-more">+{bars.length - 3} more</span>}
                    </span>
                  )}
                  {dayEvents.length > 0 && (
                    <span className="calendar-dots">
                      {dayEvents.slice(0, 4).map((ev) => (
                        <span key={ev.id} className="calendar-dot" style={{ background: ev.crew_chip_color }} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="day-list">
            <h3>{selectedDay}</h3>
            {selectedEvents.length === 0 ? (
              <div className="empty-state">No events.</div>
            ) : (
              selectedEvents.map((ev) => (
                <Link key={ev.id} to={`/p/${ev.project_id}`} className="event-row">
                  <Dot color={ev.crew_chip_color} />
                  <div>
                    <div><strong>{ev.time_label}</strong> {ev.title}</div>
                    <div className="meta" style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{ev.project_name} · {ev.crew_short_name}</div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </>
      )}

      {showNew && (
        <NewEventModal
          projects={projects}
          onClose={() => setShowNew(false)}
          onCreated={(event) => { setShowNew(false); setEvents((prev) => [...prev, event]); setSelectedDay(event.date); }}
        />
      )}
    </div>
  );
}
