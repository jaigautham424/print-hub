import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';

export default function Printers() {
  const { printers, fetchPrinters, apiBase } = useApp();
  const [syncing, setSyncing] = useState(false);

  const syncPrinters = async () => {
    setSyncing(true);
    try { await fetch(`${apiBase}/api/printers/sync`, { method: 'POST' }); await fetchPrinters(); } catch (err) { console.error(err); }
    setSyncing(false);
  };

  const togglePrinter = async (id) => {
    try { await fetch(`${apiBase}/api/printers/${id}/toggle`, { method: 'POST' }); await fetchPrinters(); } catch (err) { console.error(err); }
  };

  const setDefault = async (id) => {
    try { await fetch(`${apiBase}/api/printers/${id}/set-default`, { method: 'POST' }); await fetchPrinters(); } catch (err) { console.error(err); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: 1, textTransform: 'uppercase' }}>CONNECTED PRINTERS ({printers.length})</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Manage printers connected to this PC</p>
        </div>
        <button className="btn btn-primary" onClick={syncPrinters} disabled={syncing} style={{ letterSpacing: 1 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={syncing ? { animation: 'spin 1s linear infinite' } : {}}><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
          {syncing ? 'SCANNING...' : 'SCAN PRINTERS'}
        </button>
      </div>

      <div className="grid-2">
        {printers.map(printer => (
          <div key={printer.id} className="card" style={{ opacity: printer.enabled ? 1 : 0.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-sm)', background: printer.is_default ? 'rgba(124,92,191,0.06)' : 'var(--bg-glass)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: printer.is_default ? '1px solid rgba(124,92,191,0.15)' : '1px solid var(--border)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={printer.is_default ? 'var(--text-muted)' : 'var(--text-muted)'} strokeWidth="2"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>{printer.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{printer.driver_name || 'Unknown'} &bull; {printer.port_name || 'Unknown'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {printer.is_default ? <span className="badge badge-info">DEFAULT</span> : null}
                <span className={`badge ${printer.status === 'printing' ? 'badge-warning' : printer.status === 'idle' ? 'badge-success' : printer.status === 'error' ? 'badge-error' : printer.status === 'disabled' ? 'badge-error' : 'badge-info'}`}>{printer.status}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, fontSize: 12 }}>
                <div style={{ padding: '8px 12px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: 'var(--text-muted)', marginBottom: 2, letterSpacing: 1 }}>QUEUE</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{printer.queue_length}</div>
              </div>
                <div style={{ padding: '8px 12px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: 'var(--text-muted)', marginBottom: 2, letterSpacing: 1 }}>PAPER</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{printer.paper_available}%</div>
              </div>
                <div style={{ padding: '8px 12px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: 'var(--text-muted)', marginBottom: 2, letterSpacing: 1 }}>INK/TONER</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{printer.ink_status || 'Unknown'}</div>
              </div>
                <div style={{ padding: '8px 12px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: 'var(--text-muted)', marginBottom: 2, letterSpacing: 1 }}>CURRENT USER</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{printer.current_user || 'None'}</div>
              </div>
            </div>

            {printer.status === 'printing' && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                  <span>{printer.current_document || 'Printing...'}</span>
                  <span className="badge badge-warning">IN PROGRESS</span>
                </div>
                <div className="progress-bar"><div className="progress-fill orange" style={{ width: '50%' }} /></div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              {!printer.is_default && <button className="btn btn-secondary btn-sm" onClick={() => setDefault(printer.id)} style={{ letterSpacing: 1 }}>SET DEFAULT</button>}
              <button className={`btn btn-sm ${printer.enabled ? 'btn-danger' : 'btn-success'}`} onClick={() => togglePrinter(printer.id)} style={{ letterSpacing: 1 }}>
                {printer.enabled ? 'DISABLE' : 'ENABLE'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {printers.length === 0 && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="60" height="60"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          <h3>NO PRINTERS FOUND</h3>
          <p>Connect printers to your PC and click SCAN PRINTERS</p>
        </div>
      )}
    </div>
  );
}
