import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import Chip from '../Chip.jsx';
import Modal from '../Modal.jsx';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function OrderForm({ projectId, order, onClose, onSaved }) {
  const [form, setForm] = useState({
    order_date: order?.order_date || todayStr(),
    body: order?.body || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const saved = order
        ? await api.patch(`/projects/${projectId}/orders/${order.id}`, form)
        : await api.post(`/projects/${projectId}/orders`, form);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2 style={{ marginTop: 0 }}>{order ? 'Edit order' : 'New order'}</h2>
      <form onSubmit={submit}>
        <div className="field">
          <label>Date</label>
          <input type="date" required value={form.order_date} onChange={(e) => setForm({ ...form, order_date: e.target.value })} />
        </div>
        <div className="field">
          <label>Everything ordered</label>
          <textarea
            required
            rows={6}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="e.g. 5 gal SW 7029 eggshell x4, rollers, tape…"
          />
        </div>
        {error && <div className="login-error" style={{ color: '#b3261e' }}>{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function OrdersTab({ projectId, isAdmin, onCountChange }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    const rows = await api.get(`/projects/${projectId}/orders`);
    setOrders(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const remove = async (id) => {
    if (!confirm('Delete this order?')) return;
    await api.delete(`/projects/${projectId}/orders/${id}`);
    load();
    onCountChange && onCountChange(-1);
  };

  if (loading) return <div className="loading-state">Loading…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New order</button>
      </div>

      {orders.length === 0 ? (
        <div className="empty-state">No orders yet.</div>
      ) : (
        orders.map((o) => (
          <div key={o.id} className="order-item">
            <div className="order-date">{o.order_date}</div>
            <div className="order-body">{o.body}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Chip color={o.author_chip_color} label={o.author_short_name} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => setEditing(o)}>Edit</button>
                {isAdmin && <button className="btn btn-danger" onClick={() => remove(o.id)}>Delete</button>}
              </div>
            </div>
          </div>
        ))
      )}

      {(showNew || editing) && (
        <OrderForm
          projectId={projectId}
          order={editing}
          onClose={() => { setShowNew(false); setEditing(null); }}
          onSaved={(saved) => {
            setOrders((prev) => {
              const exists = prev.some((o) => o.id === saved.id);
              return exists ? prev.map((o) => (o.id === saved.id ? saved : o)) : [saved, ...prev];
            });
            if (!editing) onCountChange && onCountChange(1);
            setShowNew(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
