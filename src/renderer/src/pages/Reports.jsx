import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';

export default function Reports() {
  const { apiBase } = useApp();
  const [period, setPeriod] = useState(30);
  const [dailyData, setDailyData] = useState([]);
  const [printerData, setPrinterData] = useState([]);
  const [userData, setUserData] = useState([]);
  const [docData, setDocData] = useState([]);
  const [activeTab, setActiveTab] = useState('daily');

  useEffect(() => { fetchAll(); }, [period]);

  const fetchAll = async () => {
    try {
      const [d, p, u, doc] = await Promise.all([
        fetch(`${apiBase}/api/reports/daily?days=${period}`).then(r => r.json()),
        fetch(`${apiBase}/api/reports/printers`).then(r => r.json()),
        fetch(`${apiBase}/api/reports/users`).then(r => r.json()),
        fetch(`${apiBase}/api/reports/documents`).then(r => r.json()),
      ]);
      setDailyData(d); setPrinterData(p); setUserData(u); setDocData(doc);
    } catch (err) { console.error(err); }
  };

  const maxPages = Math.max(...dailyData.map(d => d.pages), 1);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: 1, textTransform: 'uppercase' }}>REPORTS &amp; ANALYTICS</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Print usage statistics and trends</p>
        </div>
        <select className="select" value={period} onChange={e => setPeriod(parseInt(e.target.value))}>
          <option value={7}>Last 7 Days</option>
          <option value={30}>Last 30 Days</option>
          <option value={90}>Last 90 Days</option>
        </select>
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        <button className={`tab ${activeTab === 'daily' ? 'active' : ''}`} onClick={() => setActiveTab('daily')}>DAILY PRINTS</button>
        <button className={`tab ${activeTab === 'printers' ? 'active' : ''}`} onClick={() => setActiveTab('printers')}>PRINTER USAGE</button>
        <button className={`tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>ACTIVE USERS</button>
        <button className={`tab ${activeTab === 'docs' ? 'active' : ''}`} onClick={() => setActiveTab('docs')}>TOP DOCUMENTS</button>
      </div>

      {activeTab === 'daily' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">DAILY PRINT JOBS &amp; PAGES</div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
              TOTAL: {dailyData.reduce((s, d) => s + d.jobs, 0)} JOBS &bull; {dailyData.reduce((s, d) => s + d.pages, 0)} PAGES
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 200, padding: '16px 0' }}>
            {dailyData.map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>{d.pages}</div>
                <div style={{ width: '100%', background: 'linear-gradient(180deg, var(--accent), var(--success))', borderRadius: 'var(--radius-sm)', height: `${(d.pages / maxPages) * 150}px`, minHeight: 4, transition: 'height 0.5s ease', boxShadow: '0 2px 10px rgba(124,92,191,0.2)' }} />
                <div style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'var(--font-display)', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>{d.date?.slice(5)}</div>
              </div>
            ))}
            {dailyData.length === 0 && <div style={{ width: '100%', textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>NO DATA FOR PERIOD</div>}
          </div>
        </div>
      )}

      {activeTab === 'printers' && (
        <div className="grid-2">
          {printerData.map((p, i) => (
            <div key={i} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'rgba(124,92,191,0.05)', border: '1px solid rgba(124,92,191,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                </div>
                <div><div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.jobs} jobs &bull; {p.pages} pages</div></div>
              </div>
              <div className="progress-bar" style={{ height: 6 }}><div className="progress-fill" style={{ width: `${printerData.length ? (p.pages / Math.max(...printerData.map(x => x.pages), 1)) * 100 : 0}%`, height: 6 }} /></div>
            </div>
          ))}
          {printerData.length === 0 && <div className="empty-state"><h3>NO PRINTER DATA</h3></div>}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table><thead><tr><th>#</th><th>USER</th><th>JOBS</th><th>PAGES</th><th>USAGE</th></tr></thead>
            <tbody>
              {userData.map((u, i) => {
                const maxUserPages = Math.max(...userData.map(x => x.pages), 1);
                return (<tr key={i}><td style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>{i + 1}</td><td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{u.user_name}</td><td>{u.jobs}</td><td style={{ fontFamily: 'var(--font-display)' }}>{u.pages}</td><td style={{ width: 200 }}><div className="progress-bar"><div className="progress-fill" style={{ width: `${(u.pages / maxUserPages) * 100}%` }} /></div></td></tr>);
              })}
              {userData.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No user data</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'docs' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table><thead><tr><th>#</th><th>DOCUMENT</th><th>PRINT COUNT</th><th>TOTAL PAGES</th></tr></thead>
            <tbody>
              {docData.map((d, i) => (<tr key={i}><td style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>{i + 1}</td><td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{d.original_name}</td><td><span className="badge badge-info" style={{ fontFamily: 'var(--font-display)' }}>{d.print_count}</span></td><td style={{ fontFamily: 'var(--font-display)' }}>{d.total_pages}</td></tr>))}
              {docData.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No document data</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
