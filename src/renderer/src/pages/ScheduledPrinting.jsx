import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';

export default function ScheduledPrinting() {
  const { printers, apiBase } = useApp();
  const navigate = useNavigate();
  const [scheduledJobs, setScheduledJobs] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ job_name: '', user_name: 'admin', scheduled_time: '', total_pages: 1, copies: 1, color_mode: 'bw', duplex_mode: 'single', paper_size: 'A4', notes: '' });
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => { fetchScheduled(); }, []);

  const fetchScheduled = async () => { try { const res = await fetch(`${apiBase}/api/scheduled`); setScheduledJobs(await res.json()); } catch (err) { console.error(err); } };

  const filteredJobs = useMemo(() => {
    if (!search) return scheduledJobs;
    const s = search.toLowerCase();
    return scheduledJobs.filter(job => (job.job_name?.toLowerCase().includes(s)) || (job.file_name?.toLowerCase().includes(s)) || (job.document_token?.includes(s)) || (job.id?.includes(s)));
  }, [scheduledJobs, search]);

  const submitScheduled = async () => {
    if (!selectedFile || !form.scheduled_time) return alert('Please select a file and schedule time');
    const fd = new FormData();
    fd.append('file', selectedFile);
    fd.append('job_name', form.job_name || selectedFile.name);
    fd.append('user_name', form.user_name);
    fd.append('scheduled_time', form.scheduled_time);
    fd.append('total_pages', form.total_pages);
    fd.append('copies', form.copies);
    fd.append('color_mode', form.color_mode);
    fd.append('duplex_mode', form.duplex_mode);
    fd.append('paper_size', form.paper_size);
    fd.append('notes', form.notes);
    try {
      await fetch(`${apiBase}/api/scheduled`, { method: 'POST', body: fd });
      setShowModal(false); setSelectedFile(null);
      setForm({ job_name: '', user_name: 'admin', scheduled_time: '', total_pages: 1, copies: 1, color_mode: 'bw', duplex_mode: 'single', paper_size: 'A4', notes: '' });
      fetchScheduled();
    } catch (err) { alert('Upload failed'); }
  };

  const cancelScheduled = async (id) => { if (!confirm('Cancel this scheduled job?')) return; await fetch(`${apiBase}/api/scheduled/${id}/cancel`, { method: 'POST' }); fetchScheduled(); };
  const deleteScheduled = async (id) => { if (!confirm('Delete this scheduled job?')) return; await fetch(`${apiBase}/api/scheduled/${id}`, { method: 'DELETE' }); fetchScheduled(); };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: 1, textTransform: 'uppercase' }}>SCHEDULED PRINT JOBS</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Schedule print jobs for future execution</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ letterSpacing: 1 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          SCHEDULE JOB
        </button>
      </div>

      <div className="search-box" style={{ marginBottom: 16, position: 'relative' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input className="input" placeholder="Search scheduled documents..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 40, width: '100%', maxWidth: 400 }} />
        {search && <button className="btn btn-sm btn-secondary" onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', padding: '4px 8px', fontSize: 10, letterSpacing: 1 }}>CLEAR</button>}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>TOKEN</th><th>JOB NAME</th><th>USER</th><th>FILE</th><th>PAGES</th><th>COPIES</th><th>COLOR</th><th>PAPER</th><th>SCHEDULED</th><th>STATUS</th><th>NOTES</th><th>ACTIONS</th></tr></thead>
            <tbody>
              {filteredJobs.map(job => (
                <tr key={job.id}>
                   <td><span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent)', fontSize: 13, background: 'rgba(124,92,191,0.06)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(124,92,191,0.12)' }}>#{job.document_token || '----'}</span></td>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{job.job_name}</td>
                  <td>{job.user_name}</td>
                  <td>{job.file_name}</td>
                  <td style={{ fontFamily: 'var(--font-display)' }}>{job.total_pages}</td>
                  <td>{job.copies}</td>
                  <td><span className={`badge ${job.color_mode === 'color' ? 'badge-purple' : 'badge-info'}`}>{job.color_mode === 'color' ? 'Color' : 'B&amp;W'}</span></td>
                  <td style={{ fontSize: 12 }}>{job.paper_size}</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{job.scheduled_time ? new Date(job.scheduled_time).toLocaleString() : '-'}</td>
                  <td><span className={`badge ${job.status === 'pending' ? 'badge-warning' : job.status === 'completed' ? 'badge-success' : job.status === 'cancelled' ? 'badge-error' : job.status === 'ready_to_print' ? 'badge-purple' : job.status === 'printing' ? 'badge-purple' : 'badge-info'}`}>{job.status}</span></td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.notes || '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-sm btn-primary" onClick={() => navigate('/print/' + job.id)} style={{ letterSpacing: 1 }}>PRINT</button>
                      {job.status === 'pending' && <><button className="btn btn-sm btn-secondary" onClick={() => cancelScheduled(job.id)}>CANCEL</button><button className="btn btn-sm btn-danger" onClick={() => deleteScheduled(job.id)}>DELETE</button></>}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredJobs.length === 0 && <tr><td colSpan="12" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>{search ? 'NO SCHEDULED JOBS FOUND' : 'NO SCHEDULED JOBS'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">SCHEDULE PRINT JOB</div>
            <div className="form-group"><label className="form-label">Job Name</label><input className="input" style={{ width: '100%' }} value={form.job_name} onChange={e => setForm({ ...form, job_name: e.target.value })} placeholder="Optional job name" /></div>
            <div className="form-group"><label className="form-label">File (PDF)</label><input type="file" accept=".pdf" onChange={e => setSelectedFile(e.target.files[0])} style={{ fontSize: 12 }} /></div>
            <div className="form-group"><label className="form-label">Schedule Time</label><input className="input" type="datetime-local" style={{ width: '100%' }} value={form.scheduled_time} onChange={e => setForm({ ...form, scheduled_time: e.target.value })} /></div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">User Name</label><input className="input" style={{ width: '100%' }} value={form.user_name} onChange={e => setForm({ ...form, user_name: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Total Pages</label><input className="input" type="number" min="1" style={{ width: '100%' }} value={form.total_pages} onChange={e => setForm({ ...form, total_pages: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Copies</label><input className="input" type="number" min="1" style={{ width: '100%' }} value={form.copies} onChange={e => setForm({ ...form, copies: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Paper Size</label><select className="select" style={{ width: '100%' }} value={form.paper_size} onChange={e => setForm({ ...form, paper_size: e.target.value })}><option value="A4">A4</option><option value="Letter">Letter</option><option value="Legal">Legal</option><option value="A3">A3</option></select></div>
              <div className="form-group"><label className="form-label">Color Mode</label><select className="select" style={{ width: '100%' }} value={form.color_mode} onChange={e => setForm({ ...form, color_mode: e.target.value })}><option value="bw">Black &amp; White</option><option value="color">Color</option></select></div>
              <div className="form-group"><label className="form-label">Duplex Mode</label><select className="select" style={{ width: '100%' }} value={form.duplex_mode} onChange={e => setForm({ ...form, duplex_mode: e.target.value })}><option value="single">Single Side</option><option value="duplex">Double Side</option></select></div>
            </div>
            <div className="form-group"><label className="form-label">Notes</label><input className="input" style={{ width: '100%' }} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" /></div>
            <div className="form-actions"><button className="btn btn-secondary" onClick={() => setShowModal(false)}>CANCEL</button><button className="btn btn-primary" onClick={submitScheduled}>SCHEDULE</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
