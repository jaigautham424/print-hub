import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';

function AnimatedCounter({ value, duration = 800 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const num = parseInt(value) || 0;
    const start = parseInt(display) || 0;
    if (num === start) return;
    const diff = num - start;
    const startTime = performance.now();
    const step = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) ref.current = requestAnimationFrame(step);
    };
    ref.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(ref.current);
  }, [value]);
  return <>{display}</>;
}

function MiniBarChart({ data, height = 40 }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: '100%',
            height: `${(d.value / max) * height}px`,
            background: d.color,
            border: '2px solid #0f0f23',
            borderRadius: 2,
            minHeight: 4,
            transition: 'height 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxShadow: `2px 2px 0 #0f0f23`,
          }} />
          {d.label && <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 0.3, fontFamily: 'var(--font-display)' }}>{d.label}</div>}
        </div>
      ))}
    </div>
  );
}

function PulseRing({ color, size = 8, active = true }) {
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: color, border: '2px solid #0f0f23',
      }} />
      {active && (
        <div style={{
          position: 'absolute', inset: -4, borderRadius: '50%',
          border: `2px solid ${color}`,
          animation: 'statusPulse 1.5s ease-in-out infinite',
        }} />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, colorClass, subtext, delay = 0 }) {
  return (
    <div className="stat-card" style={{ animation: `comicPanelIn 0.4s ${delay}s both` }}>
      <div className={`stat-icon ${colorClass}`}>{icon}</div>
      <div className="stat-value"><AnimatedCounter value={value} /></div>
      <div className="stat-label">{label}</div>
      {subtext && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-hand)', letterSpacing: 0.5 }}>{subtext}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { stats, serverStatus, apiBase } = useApp();
  const navigate = useNavigate();
  const [qrCode, setQrCode] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [copied, setCopied] = useState(false);
  const [serverRunning, setServerRunning] = useState(false);
  const [serverAction, setServerAction] = useState('');
  const [serverError, setServerError] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [serverNetwork, setServerNetwork] = useState('');
  const [autoStart, setAutoStart] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;
    const unsub = window.electronAPI.onServerStatus(s => setServerRunning(s.running));
    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);

  useEffect(() => {
    checkServer();
    loadAutoStart();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [apiBase]);

  useEffect(() => {
    if (serverRunning) {
      fetch(`${apiBase}/api/station/qr`).then(r => r.json()).then(setQrCode).catch(() => {});
      fetch(`${apiBase}/api/status`).then(r => r.json()).then(s => { setServerUrl(s.url); setServerNetwork(s.network); }).catch(() => {});
    } else {
      setQrCode(null);
      setServerUrl('');
    }
  }, [serverRunning, apiBase]);

  const checkServer = async () => {
    try {
      const res = await fetch(`${apiBase}/api/status`);
      const data = await res.json();
      setServerRunning(data.running);
      if (data.running) { setServerUrl(data.url); setServerNetwork(data.network); }
    } catch { setServerRunning(false); }
    if (window.electronAPI) { try { const s = await window.electronAPI.getServerStatus(); setServerRunning(s.running); } catch {} }
  };

  const loadAutoStart = async () => {
    try { const res = await fetch(`${apiBase}/api/settings`); const data = await res.json(); setAutoStart(data.auto_start_server === 'true' || data.auto_start_server === true); } catch {}
  };

  const handleServerAction = async (action) => {
    setServerAction(action);
    setServerError('');
    try {
      if (window.electronAPI) {
        const api = action === 'start' ? window.electronAPI.startServer : action === 'stop' ? window.electronAPI.stopServer : window.electronAPI.restartServer;
        const result = await api();
        setServerRunning(result.running);
        if (!result.running && result.message) setServerError(result.message);
      } else {
        const res = await fetch(`${apiBase}/api/server/${action}`, { method: 'POST' });
        const result = await res.json();
        setServerRunning(result.running);
        if (!result.running && result.message) setServerError(result.message);
      }
    } catch (e) { setServerError('Failed: ' + e.message); }
    setServerAction('');
  };

  const toggleAutoStart = async () => {
    const newVal = !autoStart;
    setAutoStart(newVal);
    try { await fetch(`${apiBase}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auto_start_server: String(newVal) }) }); } catch {}
  };

  const clientUrl = serverUrl ? `${serverUrl}/client` : '';
  const copyUrl = () => { navigator.clipboard.writeText(clientUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };

  const chartData = [
    { value: stats?.completedJobs || 0, color: '#2ec4b6', label: 'Done' },
    { value: stats?.activeQueue || 0, color: '#457b9d', label: 'Queue' },
    { value: stats?.activePrinting || 0, color: '#e63946', label: 'Print' },
    { value: stats?.failedJobs || 0, color: '#ff2d78', label: 'Fail' },
    { value: stats?.totalPagesToday || 0, color: '#f4d35e', label: 'Pages' },
  ];

  return (
    <div>
      {/* Hero Banner */}
      <div style={{
        marginBottom: 24, padding: 28, borderRadius: 4,
        background: '#ffffff',
        border: '3px solid #0f0f23',
        position: 'relative', overflow: 'hidden',
        boxShadow: '6px 6px 0 #0f0f23',
        animation: 'comicPanelIn 0.4s ease both',
      }}>
        {/* Halftone background pattern */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(230,57,70,0.06) 1px, transparent 1px)',
          backgroundSize: '8px 8px',
          pointerEvents: 'none',
        }} />

        {/* Action burst decoration */}
        <div style={{
          position: 'absolute', top: -20, right: -20,
          width: 100, height: 100,
          background: 'var(--bright-yellow)',
          borderRadius: '50%',
          border: '3px solid #0f0f23',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: 'rotate(15deg)',
          boxShadow: '3px 3px 0 #0f0f23',
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: '#0f0f23', transform: 'rotate(-15deg)' }}>PRINT!</span>
        </div>

        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{
                fontFamily: 'var(--font-display)', fontSize: 36,
                color: 'var(--text-primary)', marginBottom: 4,
                letterSpacing: 4, lineHeight: 1,
                textShadow: '3px 3px 0 rgba(230,57,70,0.15)',
              }}>
                PRINT HUB
              </h1>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-hand)', letterSpacing: 1 }}>
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                <span style={{ margin: '0 8px', opacity: 0.3 }}>|</span>
                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{currentTime.toLocaleTimeString()}</span>
              </p>
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              {!serverRunning ? (
                <div style={{
                  padding: '14px 20px', borderRadius: 4,
                  background: '#ffffff',
                  border: '3px solid var(--error)',
                  display: 'flex', alignItems: 'center', gap: 12,
                  boxShadow: '4px 4px 0 var(--error)',
                  animation: 'comicPanelIn 0.4s 0.15s both',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--error)', letterSpacing: 2 }}>OFFLINE!</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-hand)' }}>Click to activate</div>
                  </div>
                  <button
                    onClick={() => handleServerAction('start')}
                    disabled={serverAction === 'start'}
                    style={{
                      padding: '9px 22px', fontSize: 12, fontWeight: 700, borderRadius: 3,
                      fontFamily: 'var(--font-display)', letterSpacing: 2,
                      background: serverAction === 'start' ? '#e4e2d9' : 'var(--hero-red)',
                      color: serverAction === 'start' ? 'var(--text-muted)' : '#ffffff',
                      border: '2.5px solid #0f0f23',
                      cursor: serverAction === 'start' ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 7,
                      boxShadow: '3px 3px 0 #0f0f23',
                      whiteSpace: 'nowrap', transition: 'all 0.2s ease',
                      textTransform: 'uppercase',
                    }}
                  >
                    {serverAction === 'start' ? (
                      <><span style={{ width: 13, height: 13, border: '2px solid rgba(15,15,35,.2)', borderTopColor: 'var(--text-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> LOADING</>
                    ) : (
                      <><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> ACTIVATE!</>
                    )}
                  </button>
                  {serverError && <div style={{ fontSize: 10, color: 'var(--error)', maxWidth: 120, fontFamily: 'var(--font-hand)' }}>{serverError}</div>}
                </div>
              ) : (
                <>
                  <div style={{ textAlign: 'right', animation: 'comicPanelIn 0.4s 0.1s both' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--success)', marginBottom: 4, letterSpacing: 2 }}>CONNECT NOW!</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{clientUrl}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, fontFamily: 'var(--font-hand)' }}>{serverNetwork}</div>
                    <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
                      <button onClick={() => handleServerAction('stop')} disabled={serverAction === 'stop'}
                        style={{
                          padding: '6px 16px', fontSize: 10, fontWeight: 700, borderRadius: 3,
                          fontFamily: 'var(--font-display)', letterSpacing: 1.5,
                          background: '#ffffff', color: 'var(--error)', border: '2.5px solid var(--error)',
                          cursor: serverAction === 'stop' ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                          whiteSpace: 'nowrap', transition: 'all 0.2s ease',
                          boxShadow: '2px 2px 0 var(--error)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {serverAction === 'stop' ? (
                          <><span style={{ width: 11, height: 11, border: '2px solid rgba(230,57,70,.2)', borderTopColor: 'var(--error)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> STOP</>
                        ) : (
                          <><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"/></svg> STOP</>
                        )}
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={copyUrl} style={{ fontSize: 10 }}>
                        {copied ? (
                          <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="3"><polyline points="20,6 9,17 4,12"/></svg> COPIED!</>
                        ) : (
                          <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> COPY URL</>
                        )}
                      </button>
                    </div>
                  </div>
                  {qrCode?.qr && (
                    <div className="qr-container" style={{ animation: 'comicPanelIn 0.4s 0.2s both' }}>
                      <img src={qrCode.qr} alt="QR Code" style={{ width: 155, height: 155, display: 'block' }} />
                      <div style={{ textAlign: 'center', marginTop: 6, fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-display)', letterSpacing: 2, position: 'relative', zIndex: 1 }}>SCAN ME!</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Offline Banner */}
      {!serverRunning && (
        <div style={{
          marginBottom: 22, padding: '14px 20px', borderRadius: 4,
          background: '#ffffff',
          border: '3px solid var(--warning)',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '4px 4px 0 var(--warning)',
          animation: 'comicPanelIn 0.4s 0.1s both',
        }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--warning)',
            lineHeight: 1,
          }}>!</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text-primary)', letterSpacing: 2 }}>SERVER IS DORMANT!</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-hand)' }}>Hit <strong style={{ color: 'var(--accent)' }}>ACTIVATE</strong> to bring it to life!</div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={autoStart} onChange={toggleAutoStart} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
            Auto-start
          </label>
        </div>
      )}

      {/* Online Status Card */}
      {serverRunning && (
        <div className="card" style={{
          marginBottom: 22,
          animation: 'comicPanelIn 0.4s 0.1s both',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'var(--success)' }} />
          <div className="card-header" style={{ borderBottomColor: 'rgba(15,15,35,0.12)' }}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PulseRing color="var(--success)" size={10} />
              <span style={{ color: 'var(--success)' }}>SERVER ONLINE!</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-hand)' }}>{serverUrl}</span>
            </div>
            <div style={{ display: 'flex', gap: 7 }}>
              <button className="btn btn-sm btn-secondary" onClick={() => handleServerAction('restart')} disabled={!!serverAction}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                REFRESH
              </button>
              <button className="btn btn-sm btn-danger" onClick={() => handleServerAction('stop')} disabled={!!serverAction}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"/></svg>
                STOP
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', padding: '4px 0' }}>
            <div style={{ flex: 1 }}><MiniBarChart data={chartData} height={44} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'var(--font-display)' }}>Today's Stats</div>
              <div style={{ display: 'flex', gap: 12 }}>
                {chartData.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <div style={{ width: 8, height: 8, background: d.color, border: '1.5px solid #0f0f23', transform: 'rotate(45deg)' }} />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section Header */}
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text-primary)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--accent)' }}>///</span>
        COMMAND CENTER
        <span style={{ flex: 1, height: 2, background: '#0f0f23', opacity: 0.1 }} />
      </div>

      {/* Stat Cards */}
      <div className="grid-5" style={{ marginBottom: 24 }}>
        <StatCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18" strokeLinecap="round"/></svg>} label="DEVICES" value={stats?.totalDevices ?? 0} colorClass="blue" subtext={`${stats?.onlineDevices ?? 0} online`} delay={0} />
        <StatCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>} label="PRINTERS" value={stats?.totalPrinters ?? 0} colorClass="green" subtext={`${stats?.activePrinting ?? 0} printing`} delay={0.04} />
        <StatCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14,2 L6,2 C4.9,2 4,2.9 4,4 L4,20 C4,21.1 4.9,22 6,22 L18,22 C19.1,22 20,21.1 20,20 L20,8 Z"/><polyline points="14,2 14,8 20,8"/></svg>} label="TODAY'S JOBS" value={stats?.totalJobsToday ?? 0} colorClass="red" subtext={`${stats?.activeQueue ?? 0} queued`} delay={0.08} />
        <StatCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>} label="PAGES" value={stats?.totalPagesToday ?? 0} colorClass="gold" delay={0.12} />
        <StatCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20,6 9,17 4,12"/></svg>} label="DONE!" value={stats?.completedJobs ?? 0} colorClass="green" subtext={`${stats?.failedJobs ?? 0} failed`} delay={0.16} />
      </div>

      {/* Active Queue + Printers */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card" style={{ animation: 'comicPanelIn 0.4s 0.2s both' }}>
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              PRINT QUEUE
            </div>
            <span className="badge badge-info">{stats?.activeQueue ?? 0}</span>
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {stats?.recentJobs?.filter(j => ['uploading','processing','waiting','printing'].includes(j.status)).length === 0 ? (
              <div className="empty-state" style={{ padding: 30 }}>
                <h3>ALL CLEAR!</h3>
                <p>No jobs in the queue</p>
              </div>
            ) : (
              stats?.recentJobs?.filter(j => ['uploading','processing','waiting','printing'].includes(j.status)).map((job, i) => (
                <div key={job.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1.5px dashed rgba(15,15,35,0.08)', animation: `comicPanelIn 0.3s ${i * 0.04}s both` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <PulseRing color={job.status === 'printing' ? 'var(--accent)' : job.status === 'processing' ? 'var(--warning)' : 'var(--success)'} size={8} active={job.status === 'printing'} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{job.original_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-hand)' }}>{job.user_name} &bull; {job.total_pages} pages</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                    <button className="btn btn-sm btn-primary" onClick={() => navigate('/print/' + job.id)}>PRINT!</button>
                    <span className={`badge ${job.status === 'printing' ? 'badge-warning' : 'badge-info'}`}>{job.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card" style={{ animation: 'comicPanelIn 0.4s 0.24s both' }}>
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--info)" strokeWidth="2.5"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              PRINTERS
            </div>
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {stats?.activePrinters?.length === 0 ? (
              <div className="empty-state" style={{ padding: 30 }}><h3>NO PRINTERS</h3><p>Connect one to get started!</p></div>
            ) : (
              stats?.activePrinters?.map((printer, i) => (
                <div key={printer.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1.5px dashed rgba(15,15,35,0.08)', animation: `comicPanelIn 0.3s ${i * 0.04}s both` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <PulseRing color={printer.status === 'printing' ? 'var(--accent)' : printer.status === 'idle' ? 'var(--success)' : 'var(--error)'} size={8} active={printer.status === 'printing'} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{printer.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-hand)' }}>Queue: {printer.queue_length} &bull; {printer.driver_name || 'Driver'}</div>
                    </div>
                  </div>
                  <span className={`badge ${printer.status === 'printing' ? 'badge-warning' : printer.status === 'idle' ? 'badge-success' : printer.status === 'error' ? 'badge-error' : 'badge-info'}`}>{printer.status}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Jobs Table */}
      <div className="card" style={{ animation: 'comicPanelIn 0.4s 0.28s both' }}>
        <div className="card-header">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
            RECENT JOBS
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>#</th><th>FILE</th><th>USER</th><th>PAGES</th><th>MODE</th><th>STATUS</th><th>TIME</th><th>ACTION</th></tr></thead>
            <tbody>
              {stats?.recentJobs?.slice(0, 10).map((job, i) => (
                <tr key={job.id} style={{ animation: `comicPanelIn 0.3s ${i * 0.02}s both` }}>
                  <td style={{ fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>{i + 1}</td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{job.original_name}</td>
                  <td>{job.user_name}</td>
                  <td style={{ fontFamily: 'var(--font-display)' }}>{job.total_pages}</td>
                  <td><span className={`badge ${job.color_mode === 'color' ? 'badge-purple' : 'badge-info'}`}>{job.color_mode === 'color' ? 'Color' : 'B&W'}</span></td>
                  <td><span className={`badge ${job.status === 'completed' ? 'badge-success' : job.status === 'printing' ? 'badge-warning' : job.status === 'error' ? 'badge-error' : 'badge-info'}`}>{job.status}</span></td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{job.upload_time ? new Date(job.upload_time).toLocaleTimeString() : '-'}</td>
                  <td><button className="btn btn-sm btn-primary" onClick={() => navigate('/print/' + job.id)}>GO!</button></td>
                </tr>
              ))}
              {(!stats?.recentJobs || stats.recentJobs.length === 0) && (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontFamily: 'var(--font-hand)' }}>No jobs yet!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
