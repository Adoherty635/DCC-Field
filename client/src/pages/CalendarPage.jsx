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

function EventModal({ projects, event, onClose, onCreated, onUpdated }) {
  const isEdit = Boolean(event);
  const [form, setForm] = useState(
    isEdit
      ? { project_id: event.project_id, date: event.date, time_label: event.time_label || '', title: event.title }
      : { project_id: projects[0]?.id || '', date: dateStr(new Date()), time_label: '', title: '' }
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isEdit) {
        const updated = await api.patch(`/events/${event.id}`, form);
        onUpdated(updated);
      } else {
        const created = await api.post('/events', form);
        onCreated(created);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2 style={{ marginTop: 0 }}>{isEdit ? 'Edit event' : 'New event'}</h2>
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
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : isEdit ? 'Save' : 'Add'}</button>
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
  const [editingEvent, setEditingEvent] = useState(null);
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

  function projectDayLabel(project, dayKey) {
    const isStart = project.start_date === dayKey;
    const isEnd = project.end_date === dayKey;
    if (isStart && isEnd) return 'Starts & ends today';
    if (isStart) return 'Starts today';
    if (isEnd) return 'Ends today';
    return 'In progress';
  }

  const dayProjects = barsForDay(selectedDay);
  // Manual, specifically-scheduled events (site visits etc.) — auto Job
  // start/end rows are left out here since dayProjects already covers them.
  const dayManualEvents = (eventsByDay[selectedDay] || []).filter((ev) => !ev.auto_type);

  const deleteEvent = async (e, ev) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this event?')) return;
    await api.delete(`/events/${ev.id}`);
    setEvents((prev) => prev.filter((x) => x.id !== ev.id));
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
                  className={`calendar-cell ${outOfMonth ? 'out-of-month' : ''} ${key === todayKey ? 'today' : ''} ${key === selectedDay ? 'selected' : ''}`}
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

            {dayProjects.length === 0 && dayManualEvents.length === 0 ? (
              <div className="empty-state">No projects or events.</div>
            ) : (
              <>
                {dayProjects.map((p) => (
                  <Link key={p.id} to={`/p/${p.id}`} className="event-row">
                    <Dot color={p.crew.chip_color} />
                    <div>
                      <div><strong>{p.name}</strong></div>
                      <div className="meta" style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        {p.crew.short_name} · {projectDayLabel(p, selectedDay)} ({p.start_date} – {p.end_date})
                      </div>
                    </div>
                  </Link>
                ))}
                {dayManualEvents.map((ev) => (
                  <Link key={ev.id} to={`/p/${ev.project_id}`} className="event-row">
                    <Dot color={ev.crew_chip_color} />
                    <div>
                      <div><strong>{ev.time_label}</strong> {ev.title}</div>
                      <div className="meta" style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{ev.project_name} · {ev.crew_short_name}</div>
                    </div>
                    {user.role === 'admin' && (
                      <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                        <button
                          className="card-edit-btn"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingEvent(ev); }}
                        >
                          Edit
                        </button>
                        <button className="card-edit-btn" onClick={(e) => deleteEvent(e, ev)}>Delete</button>
                      </div>
                    )}
                  </Link>
                ))}
              </>
            )}
          </div>
        </>
      )}

      {showNew && (
        <EventModal
          projects={projects}
          onClose={() => setShowNew(false)}
          onCreated={(event) => { setShowNew(false); setEvents((prev) => [...prev, event]); setSelectedDay(event.date); }}
        />
      )}

      {editingEvent && (
        <EventModal
          projects={projects}
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onUpdated={(updated) => {
            setEditingEvent(null);
            setEvents((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
            setSelectedDay(updated.date);
          }}
        />
      )}
    </div>
  );
}
