import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';

export default function Logs() {
  const { apiBase } = useApp();
  const [logs, setLogs] = useState([]);
  const [level, setLevel] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { fetchLogs(); }, [level, category]);

  const fetchLogs = async () => {
    try { const params = new URLSearchParams(); if (level) params.set('level', level); if (category) params.set('category', category); if (search) params.set('search', search); params.set('limit', '200'); const res = await fetch(`${apiBase}/api/logs?${params}`); setLogs(await res.json()); } catch (err) { console.error(err); }
  };

  const levelColor = (l) => { const map = { info: 'badge-info', warn: 'badge-warning', error: 'badge-error', debug: 'badge-purple' }; return map[l] || 'badge-info'; };

  const exportLogs = () => { const csv = ['Time,Level,Category,Message']; logs.forEach(l => { csv.push(`"${l.created_at}","${l.level}","${l.category || ''}","${l.message.replace(/"/g, '""')}"`); }); const blob = new Blob([csv.join('\n')], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `logs-${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url); };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: 1, textTransform: 'uppercase' }}>SYSTEM LOGS</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{logs.length} log entries</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={exportLogs} style={{ letterSpacing: 1 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> EXPORT CSV</button>
          <button className="btn btn-secondary" onClick={fetchLogs} style={{ letterSpacing: 1 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg> REFRESH</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <div className="tabs">{['', 'info', 'warn', 'error', 'debug'].map(l => (<button key={l} className={`tab ${level === l ? 'active' : ''}`} onClick={() => setLevel(l)}>{l || 'ALL'}</button>))}</div>
        <select className="select" value={category} onChange={e => setCategory(e.target.value)}><option value="">All Categories</option><option value="server">Server</option><option value="upload">Upload</option><option value="print">Print</option><option value="device">Device</option><option value="error">Error</option></select>
        <div className="search-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input className="input" placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchLogs()} style={{ paddingLeft: 32, width: 220 }} /></div>
        <button className="btn btn-sm btn-secondary" onClick={fetchLogs}>SEARCH</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
          <table>
            <thead style={{ position: 'sticky', top: 0, background: 'rgba(30,26,46,0.95)', zIndex: 1 }}><tr><th style={{ width: 160 }}>TIME</th><th style={{ width: 70 }}>LEVEL</th><th style={{ width: 100 }}>CATEGORY</th><th>MESSAGE</th></tr></thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} style={log.level === 'error' ? { background: 'rgba(168,64,88,0.04)' } : {}}>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontFamily: 'var(--font-display)' }}>{log.created_at ? new Date(log.created_at).toLocaleString() : '-'}</td>
                  <td><span className={`badge ${levelColor(log.level)}`}>{log.level}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{log.category || '-'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-primary)' }}>{log.message}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>NO LOGS FOUND</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
