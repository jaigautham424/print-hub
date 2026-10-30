import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';

const eventTypes = {
  device_connected: { color: 'connected', label: 'DEVICE CONNECTED', icon: '📱' },
  device_disconnected: { color: 'disconnected', label: 'DEVICE DISCONNECTED', icon: '📱' },
  file_uploaded: { color: 'uploaded', label: 'FILE UPLOADED', icon: '📄' },
  print_started: { color: 'printing', label: 'PRINT STARTED', icon: '🖨️' },
  print_completed: { color: 'completed', label: 'PRINT COMPLETED', icon: '✅' },
  print_failed: { color: 'failed', label: 'PRINT CANCELLED', icon: '❌' },
  note_uploaded: { color: 'uploaded', label: 'NOTE UPLOADED', icon: '📝' },
};

export default function ActivityMonitor() {
  const { apiBase, activities } = useApp();
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => { try { const res = await fetch(`${apiBase}/api/logs/activity`); setLogs(await res.json()); } catch (err) { console.error(err); } };

  const allActivities = [...activities.map(a => ({ ...a, fromSocket: true })), ...logs.map(l => ({ type: l.event_type, data: JSON.parse(l.event_data || '{}'), time: l.created_at }))].sort((a, b) => new Date(b.time) - new Date(a.time));
  const filtered = filter === 'all' ? allActivities : allActivities.filter(a => a.type === filter);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: 1, textTransform: 'uppercase' }}>LIVE ACTIVITY MONITOR</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{allActivities.length} events recorded</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchLogs} style={{ letterSpacing: 1 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
          REFRESH
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('all')} style={{ letterSpacing: 1 }}>ALL</button>
        {Object.entries(eventTypes).map(([key, val]) => (
          <button key={key} className={`btn btn-sm ${filter === key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(key)} style={{ letterSpacing: 0.5 }}>{val.label}</button>
        ))}
      </div>

      <div className="card">
        <div className="activity-feed" style={{ maxHeight: 'calc(100vh - 240px)' }}>
          {filtered.map((activity, i) => {
            const info = eventTypes[activity.type] || { color: 'uploaded', label: activity.type, icon: '📋' };
            const data = activity.data || {};
            return (
              <div key={i} className="activity-item slide-in">
                <div className={`activity-dot ${info.color}`} />
                <div style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{info.icon}</div>
                <div className="activity-text">
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 12 }}>{info.label}</span>
                  {data.device_name && <span> &bull; {data.device_name}</span>}
                  {data.file_name && <span> &bull; {data.file_name}</span>}
                  {data.user && <span> &bull; {data.user}</span>}
                  {data.ip && <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}> ({data.ip})</span>}
                </div>
                <div className="activity-time">{activity.time ? new Date(activity.time).toLocaleTimeString() : ''}</div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="empty-state" style={{ padding: 30 }}><h3>NO ACTIVITY</h3><p>Events appear as users connect and print</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
