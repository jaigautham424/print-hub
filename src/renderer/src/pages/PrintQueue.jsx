import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';

export default function PrintQueue() {
  const { jobs, fetchJobs, printers, apiBase } = useApp();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('active');
  const [moveModal, setMoveModal] = useState(null);

  const filtered = jobs.filter(j => {
    if (filter === 'active') return ['uploading','processing','waiting','printing'].includes(j.status);
    if (filter === 'completed') return j.status === 'completed';
    if (filter === 'cancelled') return j.status === 'cancelled' || j.status === 'error';
    return true;
  });

  const cancelJob = async (id) => { if (!confirm('Cancel this print job?')) return; await fetch(`${apiBase}/api/jobs/${id}/cancel`, { method: 'POST' }); fetchJobs(); };
  const pauseJob = async (id) => { await fetch(`${apiBase}/api/jobs/${id}/pause`, { method: 'POST' }); fetchJobs(); };
  const resumeJob = async (id) => { await fetch(`${apiBase}/api/jobs/${id}/resume`, { method: 'POST' }); fetchJobs(); };
  const completeJob = async (id) => { await fetch(`${apiBase}/api/jobs/${id}/complete`, { method: 'POST' }); fetchJobs(); };
  const moveJob = async (jobId, printerId) => { await fetch(`${apiBase}/api/jobs/${jobId}/move`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ printer_id: printerId }) }); setMoveModal(null); fetchJobs(); };
  const updatePriority = async (id, priority) => { await fetch(`${apiBase}/api/jobs/${id}/reorder`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priority }) }); fetchJobs(); };

  const statusBadge = (status) => {
    const map = { uploading: 'badge-info', processing: 'badge-info', waiting: 'badge-warning', printing: 'badge-purple', completed: 'badge-success', cancelled: 'badge-error', error: 'badge-error' };
    return map[status] || 'badge-info';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="tabs">
          {['active', 'completed', 'cancelled', 'all'].map(f => (
            <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f.toUpperCase()} ({jobs.filter(j => { if (f === 'active') return ['uploading','processing','waiting','printing'].includes(j.status); if (f === 'completed') return j.status === 'completed'; if (f === 'cancelled') return j.status === 'cancelled' || j.status === 'error'; return true; }).length})
            </button>
          ))}
        </div>
        <button className="btn btn-secondary" onClick={fetchJobs} style={{ letterSpacing: 1 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
          REFRESH
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>#</th><th>FILE</th><th>USER</th><th>DEVICE</th><th>PAGES</th><th>COPIES</th><th>COLOR</th><th>SIDES</th><th>PAPER</th><th>PRIORITY</th><th>PRINTER</th><th>STATUS</th><th>TIME</th><th>ACTIONS</th></tr></thead>
            <tbody>
              {filtered.map((job, i) => (
                <tr key={job.id}>
                  <td style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>{i + 1}</td>
                  <td>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{job.original_name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>{(job.file_size / 1024).toFixed(1)} KB</div>
                  </td>
                  <td>{job.user_name}</td>
                  <td style={{ fontSize: 12 }}>{job.device_name}</td>
                  <td style={{ fontFamily: 'var(--font-display)' }}>{job.total_pages}</td>
                  <td>{job.copies}</td>
                  <td><span className={`badge ${job.color_mode === 'color' ? 'badge-purple' : 'badge-info'}`}>{job.color_mode === 'color' ? 'Color' : 'B&amp;W'}</span></td>
                  <td>{job.duplex_mode === 'duplex' ? 'Duplex' : 'Single'}</td>
                  <td style={{ fontSize: 12 }}>{job.paper_size}</td>
                  <td>
                    <select className="select" value={job.priority} onChange={e => updatePriority(job.id, parseInt(e.target.value))} style={{ width: 55, padding: '2px 4px', fontSize: 11 }}>
                      {[1,2,3,4,5,6,7,8,9,10].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td style={{ fontSize: 12, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{printers.find(p => p.id === job.printer_id)?.name || 'Unassigned'}</td>
                  <td><span className={`badge ${statusBadge(job.status)}`}>{job.status}</span></td>
                  <td style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{job.upload_time ? new Date(job.upload_time).toLocaleTimeString() : '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button className="btn btn-sm btn-primary" onClick={() => navigate('/print/' + job.id)} style={{ letterSpacing: 1 }}>PRINT</button>
                      {job.status === 'printing' && <button className="btn btn-sm btn-secondary" onClick={() => pauseJob(job.id)}>PAUSE</button>}
                      {job.status === 'waiting' && <button className="btn btn-sm btn-success" onClick={() => resumeJob(job.id)}>RESUME</button>}
                      {['uploading','processing','waiting','printing'].includes(job.status) && (
                        <><button className="btn btn-sm btn-secondary" onClick={() => setMoveModal(job.id)}>MOVE</button><button className="btn btn-sm btn-danger" onClick={() => cancelJob(job.id)}>CANCEL</button></>
                      )}
                      {['uploading','processing','waiting'].includes(job.status) && <button className="btn btn-sm btn-success" onClick={() => completeJob(job.id)}>DONE</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan="14" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>QUEUE EMPTY — NO JOBS FOUND</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {moveModal && (
        <div className="modal-overlay" onClick={() => setMoveModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">MOVE JOB</div>
            {printers.filter(p => p.enabled).map(p => (
              <div key={p.id} style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'var(--bg-glass)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)' }}
                onClick={() => moveJob(moveModal, p.id)}>
                <div>
                  <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Queue: {p.queue_length} &bull; {p.status}</div>
                </div>
                <span className={`badge ${p.status === 'idle' ? 'badge-success' : 'badge-warning'}`}>{p.status}</span>
              </div>
            ))}
            <div className="form-actions"><button className="btn btn-secondary" onClick={() => setMoveModal(null)}>CANCEL</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
