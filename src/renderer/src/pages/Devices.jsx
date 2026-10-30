import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';

const statusColors = { online: 'badge-success', uploading: 'badge-info', waiting: 'badge-warning', printing: 'badge-warning', offline: 'badge-error' };

export default function Devices() {
  const { devices, fetchDevices, apiBase } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchDevices(); }, []);

  const filtered = devices.filter(d => {
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !d.ip_address.includes(search)) return false;
    if (filter !== 'all' && d.status !== filter) return false;
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="tabs">
            {['all', 'online', 'uploading', 'waiting', 'printing', 'offline'].map(f => (
              <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="search-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input className="input" placeholder="Search devices..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32, width: 220 }} /></div>
          <button className="btn btn-secondary" onClick={fetchDevices} style={{ letterSpacing: 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
            REFRESH
          </button>
        </div>
      </div>

      <div className="grid-3">
        {filtered.map(device => (
          <div key={device.id} className="card slide-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: device.status === 'offline' ? 'rgba(168,64,88,0.06)' : 'rgba(107,140,66,0.05)', border: `1px solid ${device.status === 'offline' ? 'rgba(168,64,88,0.12)' : 'rgba(107,140,66,0.12)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={device.status === 'offline' ? 'var(--text-secondary)' : 'var(--success)'} strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18" strokeLinecap="round" strokeWidth="3"/></svg>
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{device.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>{device.ip_address}</div>
                </div>
              </div>
              <span className={`badge ${statusColors[device.status] || 'badge-info'}`}>{device.status}</span>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 0.5 }}>CONNECTED</span><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{device.connection_time ? new Date(device.connection_time).toLocaleString() : '-'}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 0.5 }}>LAST ACTIVE</span><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{device.last_activity ? new Date(device.last_activity).toLocaleTimeString() : '-'}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 0.5 }}>CURRENT JOB</span><span style={{ color: device.current_job_id ? 'var(--text-muted)' : 'var(--text-muted)', fontWeight: 500 }}>{device.current_job_id ? 'Active' : 'None'}</span></div>
            </div>

            <div style={{ marginTop: 8 }}>
              <div className="progress-bar"><div className={`progress-fill ${device.status === 'offline' ? 'red' : device.status === 'printing' ? 'orange' : 'green'}`} style={{ width: device.status === 'offline' ? '0%' : '100%' }} /></div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18" strokeLinecap="round"/></svg>
          <h3>NO DEVICES FOUND</h3>
          <p>Devices will appear when users connect to the print server</p>
        </div>
      )}
    </div>
  );
}
