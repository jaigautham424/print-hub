import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';

export default function PrintPreview() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { apiBase } = useApp();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [toast, setToast] = useState(null);
  const iframeRef = useRef(null);

  useEffect(() => { fetchJob(); }, [jobId]);

  const fetchJob = async () => { try { setLoading(true); setError(null); const res = await fetch(`${apiBase}/api/print/job/${jobId}`); if (!res.ok) throw new Error('Job not found'); const data = await res.json(); setJob(data); } catch (err) { setError(err.message); } finally { setLoading(false); } };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const updateStatus = async (status) => { try { await fetch(`${apiBase}/api/print/${jobId}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }); } catch (e) { console.error('Failed to update status:', e); } };

  const handlePrint = async () => {
    setPrinting(true);
    await updateStatus('printing');
    showToast('Connecting to printer...');
    if (window.electronAPI?.printPage) {
      try { await window.electronAPI.printPage(); await updateStatus('completed'); showToast('Print completed'); setPrinting(false); return; } catch (e) { console.log('Electron print not available'); }
    }
    if (iframeRef.current) {
      try { iframeRef.current.contentWindow.print(); await updateStatus('completed'); showToast('Print dialog opened'); setPrinting(false); return; } catch (e) { console.log('Iframe print failed'); }
    }
    window.open(`${apiBase}${job.print_url}`, '_blank');
    showToast('PDF opened in new tab');
    setPrinting(false);
  };

  const handleDownload = () => { const a = document.createElement('a'); a.href = `${apiBase}${job.print_url}`; a.download = job.original_name; a.click(); };
  const handleOpenInBrowser = () => { window.open(`${apiBase}${job.print_url}`, '_blank'); };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.center}>
          <div style={styles.spinner} />
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: 1, marginTop: 16 }}>LOADING PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.center}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" style={{ marginBottom: 16 }}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: 16, marginBottom: 8, letterSpacing: 1 }}>UNABLE TO LOAD PDF</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>{error}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={fetchJob} style={{ letterSpacing: 1 }}>RETRY</button>
            <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ letterSpacing: 1 }}>BACK</button>
          </div>
        </div>
      </div>
    );
  }

  if (!job) return null;

  const ext = job.original_name?.split('.').pop()?.toLowerCase() || '';
  const isPdf = ext === 'pdf';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext);
  const fileUrl = `${apiBase}${job.print_url}`;
  const sizeStr = job.file_size < 1024 * 1024 ? (job.file_size / 1024).toFixed(1) + ' KB' : (job.file_size / (1024 * 1024)).toFixed(1) + ' MB';
  const statusColor = job.status === 'completed' ? 'var(--success)' : job.status === 'printing' ? 'var(--accent-hover)' : job.status === 'error' ? 'var(--error)' : 'var(--text-muted)';
  const colorLabel = job.color_mode === 'color' ? 'Color' : 'Black & White';

  return (
    <div style={styles.container}>
      {toast && <div style={styles.toast}>{toast}</div>}

      <div style={styles.topbar}>
        <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ fontSize: 11, padding: '6px 12px', letterSpacing: 1 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15,18 9,12 15,6"/></svg> BACK
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 2 }}>PRINT DOCUMENT</span>
          <span style={{ padding: '3px 10px', borderRadius: 3, fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-display)', letterSpacing: 1, background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}30` }}>{job.status?.toUpperCase()}</span>
        </div>
        <div style={{ width: 80 }} />
      </div>

      <div style={styles.main}>
        <div style={styles.sidebar}>
          <h3 style={styles.sidebarTitle}>FILE DETAILS</h3>
          <InfoRow label="TOKEN" value={<span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'rgba(124,92,191,0.06)', border: '1px solid rgba(124,92,191,0.12)' }}>#{job.document_token || '----'}</span>} />
          <InfoRow label="FILE" value={job.original_name} />
          <InfoRow label="USER" value={job.user_name || 'Guest'} />
          <InfoRow label="SIZE" value={sizeStr} />
          <InfoRow label="PAGES" value={job.total_pages || 1} />
          <InfoRow label="UPLOADED" value={job.upload_time ? new Date(job.upload_time).toLocaleString() : '-'} />

          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>PRINT SETTINGS</h4>
            <SettingItem label="COPIES" value={job.copies || 1} />
            <SettingItem label="COLOR" value={colorLabel} />
            <SettingItem label="PAPER" value={job.paper_size || 'A4'} />
            <SettingItem label="DUPLEX" value={job.duplex_mode === 'duplex' ? 'Double-sided' : 'Single-sided'} />
          </div>

          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>ACTIONS</h4>
            <button className="btn btn-secondary" onClick={handleOpenInBrowser} style={styles.actionBtn}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> Open in Browser</button>
            <button className="btn btn-secondary" onClick={handleDownload} style={styles.actionBtn}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download</button>
          </div>
        </div>

        <div style={styles.viewer}>
          {isPdf ? (
            <iframe ref={iframeRef} src={fileUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF Preview" />
          ) : isImage ? (
            <div style={styles.imgWrap}><img src={fileUrl} alt={job.original_name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)' }} /></div>
          ) : (
            <div style={styles.center}><p style={{ color: 'var(--text-muted)' }}>Preview not available</p><p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>{job.original_name}</p></div>
          )}
        </div>
      </div>

      <div style={styles.bottombar}>
        <button className="btn btn-secondary" onClick={handleOpenInBrowser} style={{ fontSize: 12, padding: '10px 20px', letterSpacing: 1 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          OPEN IN BROWSER
        </button>
        <button className="btn btn-primary" onClick={handlePrint} disabled={printing} style={{ fontSize: 14, padding: '10px 28px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: 1, opacity: printing ? 0.7 : 1 }}>
          {printing ? (<><span style={styles.spinnerSmall} /> PRINTING...</>) : (<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> PRINT DOCUMENT</>)}
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: 'var(--text-muted)', letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={typeof value === 'string' ? value : ''}>{value}</span>
    </div>
  );
}

function SettingItem({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 0.5 }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' },
  topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: 'rgba(30,26,46,0.88)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  main: { flex: 1, display: 'flex', overflow: 'hidden' },
  sidebar: { width: 280, flexShrink: 0, padding: 20, borderRight: '1px solid var(--border)', overflowY: 'auto', background: 'rgba(30,26,46,0.72)', backdropFilter: 'blur(12px)' },
  sidebarTitle: { fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)', letterSpacing: 1 },
  section: { marginTop: 20 },
  sectionTitle: { fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 10 },
  actionBtn: { width: '100%', justifyContent: 'center', marginBottom: 8, fontSize: 12, padding: '8px 12px', letterSpacing: 0.5 },
  viewer: { flex: 1, overflow: 'hidden', background: 'rgba(30,26,46,0.92)' },
  imgWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 20 },
  bottombar: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '14px 20px', background: 'rgba(30,26,46,0.88)', backdropFilter: 'blur(16px)', borderTop: '1px solid var(--border)', flexShrink: 0 },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' },
  spinner: { width: 32, height: 32, border: '2px solid var(--border)', borderTopColor: 'var(--text-muted)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', boxShadow: 'none' },
  spinnerSmall: { display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(124,92,191,0.2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  toast: { position: 'fixed', top: 20, right: 20, zIndex: 9999, background: 'var(--bg-card)', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', padding: '12px 20px', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 700, letterSpacing: 1, boxShadow: '0 4px 20px rgba(30,26,46,0.4)', animation: 'slideIn 0.2s ease-out', textTransform: 'uppercase', border: '1px solid var(--bg-glass-border)' },
};
