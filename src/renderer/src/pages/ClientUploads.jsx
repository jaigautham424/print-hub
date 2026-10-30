import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';

export default function ClientUploads() {
  const { apiBase } = useApp();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchJobs(); const interval = setInterval(fetchJobs, 5000); return () => clearInterval(interval); }, []);

  const fetchJobs = async () => { try { const res = await fetch(`${apiBase}/api/client-uploads`); setJobs(await res.json()); } catch (err) { console.error(err); } finally { setLoading(false); } };

  const filtered = useMemo(() => {
    return jobs.filter(j => {
      if (filter === 'active') return ['uploading', 'processing', 'waiting', 'printing'].includes(j.status);
      if (filter === 'completed') return j.status === 'completed';
      if (filter === 'error') return j.status === 'error' || j.status === 'cancelled';
      return true;
    }).filter(j => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (j.original_name?.toLowerCase().includes(s) || j.document_token?.includes(s) || j.id?.includes(s));
    });
  }, [jobs, filter, search]);

  const formatSize = (bytes) => { if (bytes < 1024) return bytes + ' B'; if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'; return (bytes / (1024 * 1024)).toFixed(1) + ' MB'; };

  const statusBadge = (status) => { const map = { uploading: 'badge-info', processing: 'badge-info', waiting: 'badge-warning', printing: 'badge-purple', completed: 'badge-success', cancelled: 'badge-error', error: 'badge-error' }; return map[status] || 'badge-info'; };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: 1, textTransform: 'uppercase' }}>CLIENT UPLOADS</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Files uploaded from mobile &bull; {jobs.length} total
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
               <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)',                 boxShadow: '0 0 6px rgba(107,140,66,0.4)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              AUTO-REFRESH
            </span>
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchJobs} style={{ letterSpacing: 1 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
          REFRESH
        </button>
      </div>

      <div className="search-box" style={{ marginBottom: 16, position: 'relative' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input className="input" placeholder="Search by document name or 4-digit token..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 40, width: '100%', maxWidth: 400 }} />
        {search && <button className="btn btn-sm btn-secondary" onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', padding: '4px 8px', fontSize: 10, letterSpacing: 1 }}>CLEAR</button>}
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        {['all', 'active', 'completed', 'error'].map(f => (
          <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.toUpperCase()} ({filtered.filter(j => { if (f === 'all') return true; if (f === 'active') return ['uploading', 'processing', 'waiting', 'printing'].includes(j.status); if (f === 'completed') return j.status === 'completed'; if (f === 'error') return j.status === 'error' || j.status === 'cancelled'; return true; }).length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state" style={{ padding: 60 }}><p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>LOADING...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="60" height="60"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <h3>NO CLIENT UPLOADS</h3>
          <p>{search ? 'No matching documents found.' : 'Files uploaded from mobile via QR code will appear here'}</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>#</th><th>TOKEN</th><th>FILE</th><th>USER</th><th>DEVICE</th><th>PAGES</th><th>COPIES</th><th>COLOR</th><th>PAPER</th><th>SIZE</th><th>STATUS</th><th>TIME</th><th>ACTIONS</th></tr></thead>
              <tbody>
                {filtered.map((job, i) => (
                  <tr key={job.id}>
                    <td style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>{i + 1}</td>
                    <td><span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent)', fontSize: 13, background: 'rgba(124,92,191,0.06)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(124,92,191,0.12)' }}>#{job.document_token || '----'}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'rgba(107,140,66,0.05)', border: '1px solid rgba(107,140,66,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-muted)' }}>{job.original_name?.split('.').pop()?.toUpperCase() || '?'}</div>
                        <div style={{ minWidth: 0 }}><div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{job.original_name}</div></div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(124,92,191,0.08)', border: '1px solid rgba(124,92,191,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-muted)' }}>{job.user_name?.charAt(0)?.toUpperCase() || 'G'}</div>
                        <span style={{ fontSize: 12 }}>{job.user_name}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.device_name || '-'}</td>
                    <td style={{ fontFamily: 'var(--font-display)' }}>{job.total_pages}</td>
                    <td>{job.copies}</td>
                    <td><span className={`badge ${job.color_mode === 'color' ? 'badge-purple' : 'badge-info'}`}>{job.color_mode === 'color' ? 'Color' : 'B&amp;W'}</span></td>
                    <td style={{ fontSize: 12 }}>{job.paper_size}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>{formatSize(job.file_size)}</td>
                    <td><span className={`badge ${statusBadge(job.status)}`}>{job.status}</span></td>
                    <td style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontFamily: 'var(--font-display)' }}>{job.upload_time ? new Date(job.upload_time).toLocaleString() : '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm btn-primary" onClick={() => navigate('/print/' + job.id)} style={{ letterSpacing: 1 }}>PRINT</button>
                        <a className="btn btn-sm btn-secondary" href={`${apiBase}/api/jobs/${job.id}/file`} download style={{ textDecoration: 'none', letterSpacing: 1 }}>DOWNLOAD</a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}
