import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import Printers from './pages/Printers';
import PrintQueue from './pages/PrintQueue';
import ScheduledPrinting from './pages/ScheduledPrinting';
import NotesLibrary from './pages/NotesLibrary';
import ActivityMonitor from './pages/ActivityMonitor';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Logs from './pages/Logs';
import ClientUploads from './pages/ClientUploads';
import PrintPreview from './pages/PrintPreview';

const navItems = [
  { path: '/', label: 'Dashboard', icon: 'dashboard' },
  { path: '/devices', label: 'Devices', icon: 'devices' },
  { path: '/printers', label: 'Printers', icon: 'printers' },
  { path: '/queue', label: 'Print Queue', icon: 'queue' },
  { path: '/scheduled', label: 'Scheduled', icon: 'scheduled' },
  { path: '/notes', label: 'Notes Library', icon: 'notes' },
  { path: '/client-uploads', label: 'Client Uploads', icon: 'uploads' },
  { path: '/activity', label: 'Activity', icon: 'activity' },
  { path: '/reports', label: 'Reports', icon: 'reports' },
  { path: '/logs', label: 'Logs', icon: 'logs' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];

function NavIcon({ icon }) {
  const icons = {
    dashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    devices: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18" strokeLinecap="round"/></svg>,
    printers: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
    queue: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
    scheduled: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>,
    notes: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14,2 L6,2 C4.9,2 4,2.9 4,4 L4,20 C4,21.1 4.9,22 6,22 L18,22 C19.1,22 20,21.1 20,20 L20,8 Z"/><polyline points="14,2 14,8 20,8"/></svg>,
    uploads: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
    activity: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>,
    reports: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    logs: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14,2 L6,2 C4.9,2 4,2.9 4,4 L4,20 C4,21.1 4.9,22 6,22 L18,22 C19.1,22 20,21.1 20,20 L20,8 Z"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M12,1 L12,3 M12,21 L12,23 M4.22,4.22 L5.64,5.64 M18.36,18.36 L19.78,19.78 M1,12 L3,12 M21,12 L23,12 M4.22,19.78 L5.64,18.36 M18.36,5.64 L19.78,4.22"/></svg>,
  };
  return icons[icon] || null;
}

function ComicFilters() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        <filter id="ink-outline">
          <feMorphology operator="dilate" radius="1" in="SourceGraphic" result="dilated"/>
          <feFlood floodColor="#0f0f23" floodOpacity="1" result="black"/>
          <feComposite in="black" in2="dilated" operator="in" result="outline"/>
          <feMerge><feMergeNode in="outline"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="ink-outline-red">
          <feMorphology operator="dilate" radius="1" in="SourceGraphic" result="dilated"/>
          <feFlood floodColor="#dc2626" floodOpacity="1" result="outline-red"/>
          <feComposite in="outline-red" in2="dilated" operator="in" result="filled-outline"/>
          <feMerge><feMergeNode in="filled-outline"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="ink-outline-purple">
          <feMorphology operator="dilate" radius="1" in="SourceGraphic" result="dilated"/>
          <feFlood floodColor="#a855f7" floodOpacity="1" result="outline-purple"/>
          <feComposite in="outline-purple" in2="dilated" operator="in" result="filled-outline-purple"/>
          <feMerge><feMergeNode in="filled-outline-purple"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="action-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="action-glow-red">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor="#dc2626" floodOpacity="0.3" result="glow-red"/>
          <feComposite in="glow-red" in2="blur" operator="in"/>
          <feMerge><feMergeNode in="result"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="action-glow-purple">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor="#a855f7" floodOpacity="0.3" result="glow-purple"/>
          <feComposite in="glow-purple" in2="blur" operator="in"/>
          <feMerge><feMergeNode in="result"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
    </svg>
  );
}

function PrinterCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let time = 0;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const printer = {
      x: canvas.width * 0.1,
      y: canvas.height * 0.2,
      width: 80,
      height: 50,
      feedSpeed: 0,
      rpm: 0,
      printing: false,
      pageOffset: -50,
      paperStack: [],
      sparks: [],
      plume: []
    };

    const particles = [];

    const drawPaper = (x, y, size, alpha = 1, angle = 0) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0f0f23';
      ctx.lineWidth = 1;
      ctx.fillRect(-size * 0.5, -size * 0.5, size, size);
      ctx.strokeRect(-size * 0.5, -size * 0.5, size, size);
      
      const dotX = -size * 0.3 + Math.random() * size * 0.6;
      const dotY = -size * 0.3 + Math.random() * size * 0.6;
      const dotR = Math.random() * 1.5 + 0.5;
      
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(220, 38, 38, 0.6)';
      ctx.fill();
      
      ctx.restore();
    };

    const drawSpark = (x, y, type = 'red') => {
      const color = type === 'red' ? '#dc2626' : '#a855f7';
      const size = Math.random() * 4 + 2;
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      if (Math.random() > 0.5) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const drawPlume = (x, y, vx, vy) => {
      const particle = {
        x, y, vx, vy,
        life: 1,
        decay: Math.random() * 0.02 + 0.01,
        size: Math.random() * 3 + 1,
        color: Math.random() > 0.5 ? '#dc2626' : '#a855f7',
        swirl: (Math.random() - 0.5) * 0.05
      };
      particles.push(particle);
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 1;

      printer.feedSpeed = (Math.sin(time * 0.05) + 1) * 2;
      printer.rpm = 100 + (Math.sin(time * 0.08) + 1) * 50;
      printer.printing = Math.random() > 0.3;

      const feedY = printer.y + printer.height / 2 + printer.feedSpeed * 3;

      drawPaper(printer.x + printer.width / 2, feedY + 10, 40, 0.9, 0);

      if (time % 15 === 0 && Math.random() > 0.4) {
        drawPaper(printer.x + printer.width + 20, feedY - 5, 35, 0.8, -0.2);
      }

      if (time % 30 === 0 && Math.random() > 0.5) {
        drawSpark(printer.x + Math.random() * printer.width, printer.y + Math.random() * printer.height, Math.random() > 0.5 ? 'red' : 'purple');
      }

      if (printer.printing && time % 10 === 0) {
        drawPlume(printer.x + printer.width + 5, printer.y + Math.random() * printer.height, 0.5, (Math.random() - 0.5) * 0.5);
        if (Math.random() > 0.3) {
          const paperYOffset = printer.pageOffset % 60;
          drawPaper(printer.x + printer.width, feedY + paperYOffset - 50, 30, 0.7, -0.1);
          printer.pageOffset += 1;
        }
      }

      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.02;
        p.life -= p.decay;
        p.swirl += 0.02;
        
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 5;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.swirl);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size * 0.5, -p.size * 0.5, p.size, p.size);
        ctx.restore();
      });

      if (particles.length > 100) {
        particles.splice(0, particles.length - 100);
      }

      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, 'rgba(220, 38, 38, 0.03)');
      gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.03)');
      gradient.addColorStop(1, 'rgba(220, 38, 38, 0.03)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }} />;
}

function SpeedLines() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let time = 0;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const lines = [];
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20 + (Math.random() - 0.5) * 0.3;
      lines.push({
        angle,
        length: Math.random() * 120 + 60,
        width: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.02 + 0.01,
        speed: Math.random() * 0.3 + 0.1,
        phase: Math.random() * Math.PI * 2,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 1;
      const cx = canvas.width * 0.5;
      const cy = canvas.height * 0.5;

      lines.forEach(l => {
        const pulse = Math.sin(time * 0.008 + l.phase) * 0.5 + 0.5;
        const len = l.length + pulse * 40;
        const alpha = l.alpha + pulse * 0.01;

        const x1 = cx + Math.cos(l.angle) * 200;
        const y1 = cy + Math.sin(l.angle) * 200;
        const x2 = cx + Math.cos(l.angle) * (200 + len);
        const y2 = cy + Math.sin(l.angle) * (200 + len);

        const color = Math.sin(time * 0.01 + l.angle) > 0 ? 'rgba(220, 38, 38, 0.015)' : 'rgba(168, 85, 247, 0.015)';
        ctx.strokeStyle = color;
        ctx.lineWidth = l.width;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });

      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none', opacity: 0.6 }} />;
}

function FloatingComicElements() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let time = 0;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const elements = [];
    const symbols = ['!', '?', '#', '*', 'POW', 'BAM', 'ZAP', 'BOOM', 'WHAM', '@', '%', '+', '='];
    const colors = ['#dc2626', '#a855f7', '#f4d35e', '#00d4ff', '#fff'];

    for (let i = 0; i < 15; i++) {
      elements.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        symbol: symbols[Math.floor(Math.random() * symbols.length)],
        size: Math.random() * 14 + 8,
        alpha: Math.random() * 0.04 + 0.01,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.2,
        phase: Math.random() * Math.PI * 2,
        rot: Math.random() * 0.5 - 0.25,
        rotSpeed: (Math.random() - 0.5) * 0.003,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 1;

      elements.forEach(e => {
        e.x += e.vx + Math.sin(time * 0.002 + e.phase) * 0.15;
        e.y += e.vy + Math.cos(time * 0.002 + e.phase) * 0.1;
        e.rot += e.rotSpeed;

        if (e.x < -40) e.x = canvas.width + 40;
        if (e.x > canvas.width + 40) e.x = -40;
        if (e.y < -40) e.y = canvas.height + 40;
        if (e.y > canvas.height + 40) e.y = -40;

        const pulse = Math.sin(time * 0.012 + e.phase) * 0.01;
        const alpha = e.alpha + pulse;

        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.rot);
        ctx.font = `bold ${e.size}px 'Bangers', Impact, sans-serif`;
        ctx.fillStyle = e.color;
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.strokeStyle = '#0f0f23';
        ctx.lineWidth = 0.5;
        ctx.strokeText(e.symbol, 0, 0);
        ctx.fillText(e.symbol, 0, 0);

        ctx.globalAlpha = 1;
        ctx.restore();
      });

      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none', opacity: 0.6 }} />;
}

function InkSplatterTrail() {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const handleMouse = (e) => {
      const colors = ['#dc2626', '#a855f7', '#f4d35e', '#00d4ff'];
      for (let i = 0; i < 3; i++) {
        particlesRef.current.push({
          x: e.clientX + (Math.random() - 0.5) * 6,
          y: e.clientY + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 2.5,
          vy: (Math.random() - 0.5) * 2 - 0.5,
          life: 1,
          decay: Math.random() * 0.025 + 0.02,
          size: Math.random() * 4 + 1,
          color: colors[Math.floor(Math.random() * colors.length)],
          shape: Math.random() > 0.5 ? 'circle' : 'diamond',
        });
      }
    };

    window.addEventListener('mousemove', handleMouse);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current = particlesRef.current.filter(p => p.life > 0);

      particlesRef.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.03;
        p.life -= p.decay;

        const alpha = p.life * 0.6;

        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = '#0f0f23';
        ctx.lineWidth = 1;

        if (p.shape === 'diamond') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-p.size * 0.5, -p.size * 0.5, p.size, p.size);
          ctx.strokeRect(-p.size * 0.5, -p.size * 0.5, p.size, p.size);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      });

      if (particlesRef.current.length > 200) {
        particlesRef.current = particlesRef.current.slice(-200);
      }

      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouse);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9997, pointerEvents: 'none' }} />;
}

function VideoBg() {
  return (
    <div className="video-bg">
      <div className="bg-gradient" />
      <div className="speed-lines" />
    </div>
  );
}

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { serverStatus } = useApp();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="sidebar" style={collapsed ? { width: 64, minWidth: 64 } : {}}>
      <div className="sidebar-header">
        <div className="sidebar-logo" onClick={() => setCollapsed(!collapsed)} style={{ cursor: 'pointer' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9"/></svg>
        </div>
        {!collapsed && (
          <div>
            <div className="sidebar-title">Print Hub</div>
            <div className="sidebar-subtitle">Comic Edition</div>
          </div>
        )}
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item, i) => {
          const isSection = i === 0 || i === 1 || i === 7;
          return (
            <React.Fragment key={item.path}>
              {isSection && !collapsed && (
                <div className="nav-section-label">{i === 0 ? 'Overview' : i === 1 ? 'Management' : 'System'}</div>
              )}
              <div
                className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
                title={collapsed ? item.label : undefined}
              >
                <NavIcon icon={item.icon} />
                {!collapsed && <span>{item.label}</span>}
              </div>
            </React.Fragment>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="server-status">
          <div className={`status-dot ${serverStatus.running ? '' : 'offline'}`} />
          {!collapsed && (
            <div>
              <div style={{ fontWeight: 700, color: '#ffffff', fontSize: 12, fontFamily: 'var(--font-display)', letterSpacing: 1 }}>
                {serverStatus.running ? 'ONLINE' : 'OFFLINE'}
              </div>
              {serverStatus.ip && (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2, fontFamily: 'var(--font)', letterSpacing: 0.5 }}>
                  {serverStatus.ip}:{serverStatus.port}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TopBar({ title }) {
  return (
    <div className="topbar">
      <div className="topbar-title">{title}</div>
      <div className="topbar-actions">
        <div className="window-controls">
          <button className="window-btn" onClick={() => window.electronAPI?.minimize()} title="Minimize">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button className="window-btn" onClick={() => window.electronAPI?.maximize()} title="Maximize">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
          </button>
          <button className="window-btn close" onClick={() => window.electronAPI?.close()} title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function PageRouter() {
  const location = useLocation();
  const titles = {
    '/': 'Dashboard', '/devices': 'Device Management', '/printers': 'Printer Management',
    '/queue': 'Print Queue', '/scheduled': 'Scheduled Printing', '/notes': 'Notes Library',
    '/client-uploads': 'Client Uploads', '/activity': 'Activity Monitor',
    '/reports': 'Reports & Analytics', '/settings': 'Settings', '/logs': 'System Logs',
  };
  return (
    <div className="main-content">
      <TopBar title={titles[location.pathname] || 'Print Hub'} />
      <div className="page-content fade-in" key={location.pathname}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/printers" element={<Printers />} />
          <Route path="/queue" element={<PrintQueue />} />
          <Route path="/scheduled" element={<ScheduledPrinting />} />
          <Route path="/notes" element={<NotesLibrary />} />
          <Route path="/client-uploads" element={<ClientUploads />} />
          <Route path="/activity" element={<ActivityMonitor />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/print/:jobId" element={<PrintPreview />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Router>
        <ComicFilters />
        <div className="app-layout">
          <PrinterCanvas />
          <SpeedLines />
          <FloatingComicElements />
          <InkSplatterTrail />
          <Sidebar />
          <PageRouter />
        </div>
      </Router>
    </AppProvider>
  );
}