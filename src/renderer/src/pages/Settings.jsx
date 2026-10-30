import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';

export default function Settings() {
  const { apiBase, darkMode, setDarkMode } = useApp();
  const [settings, setSettings] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => { try { const res = await fetch(`${apiBase}/api/settings`); setSettings(await res.json()); } catch (err) { console.error(err); } };

  const updateSetting = (key, value) => { setSettings(prev => ({ ...prev, [key]: value })); };

  const saveSettings = async () => {
    try { await fetch(`${apiBase}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) }); setSaved(true); setTimeout(() => setSaved(false), 2000); } catch (err) { alert('Failed to save settings'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: 1, textTransform: 'uppercase' }}>SETTINGS</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Configure Print Hub preferences</p>
        </div>
        <button className="btn btn-primary" onClick={saveSettings} style={{ letterSpacing: 1 }}>
          {saved ? (<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20,6 9,17 4,12"/></svg> SAVED!</>) : (<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/></svg> SAVE SETTINGS</>)}
        </button>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><div className="card-title">PRINT DEFAULTS</div></div>
          <div className="form-group"><label className="form-label">Default Paper Size</label><select className="select" style={{ width: '100%' }} value={settings.default_paper_size || 'A4'} onChange={e => updateSetting('default_paper_size', e.target.value)}><option value="A4">A4</option><option value="Letter">Letter</option><option value="Legal">Legal</option><option value="A3">A3</option></select></div>
          <div className="form-group"><label className="form-label">Default Color Mode</label><select className="select" style={{ width: '100%' }} value={settings.default_color_mode || 'bw'} onChange={e => updateSetting('default_color_mode', e.target.value)}><option value="bw">Black &amp; White</option><option value="color">Color</option></select></div>
          <div className="form-group"><label className="form-label">Default Duplex Mode</label><select className="select" style={{ width: '100%' }} value={settings.default_duplex_mode || 'single'} onChange={e => updateSetting('default_duplex_mode', e.target.value)}><option value="single">Single Side</option><option value="duplex">Double Side</option></select></div>
          <div className="form-group"><label className="form-label">Default Copies</label><input className="input" type="number" min="1" max="100" style={{ width: '100%' }} value={settings.default_copies || '1'} onChange={e => updateSetting('default_copies', e.target.value)} /></div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">LIMITS & STORAGE</div></div>
          <div className="form-group"><label className="form-label">Upload Size Limit (MB)</label><input className="input" type="number" min="1" max="500" style={{ width: '100%' }} value={settings.upload_size_limit || '50'} onChange={e => updateSetting('upload_size_limit', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Max Queue Size</label><input className="input" type="number" min="1" max="1000" style={{ width: '100%' }} value={settings.max_queue_size || '100'} onChange={e => updateSetting('max_queue_size', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Auto Delete (days, 0 = never)</label><input className="input" type="number" min="0" max="365" style={{ width: '100%' }} value={settings.auto_delete_days || '30'} onChange={e => updateSetting('auto_delete_days', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Server Port</label><input className="input" type="number" min="1024" max="65535" style={{ width: '100%' }} value={settings.server_port || '3000'} onChange={e => updateSetting('server_port', e.target.value)} /></div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">FILE PATHS</div></div>
          <div className="form-group"><label className="form-label">Notes Library Path</label><input className="input" style={{ width: '100%' }} value={settings.notes_library_path || ''} onChange={e => updateSetting('notes_library_path', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Upload Folder Path</label><input className="input" style={{ width: '100%' }} value={settings.upload_folder_path || ''} onChange={e => updateSetting('upload_folder_path', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Backup Folder Path</label><input className="input" style={{ width: '100%' }} value={settings.backup_folder_path || ''} onChange={e => updateSetting('backup_folder_path', e.target.value)} /></div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">SERVER</div></div>
          <div className="form-group">
            <label className="form-label">Auto Start Server</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.auto_start_server === 'true' || settings.auto_start_server === true} onChange={e => updateSetting('auto_start_server', String(e.target.checked))} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />
                Automatically start server when Print Hub launches
              </label>
            </div>
          </div>
          <div className="form-group"><label className="form-label">Server Port</label><input className="input" type="number" min="1024" max="65535" style={{ width: '100%' }} value={settings.server_port || '3000'} onChange={e => updateSetting('server_port', e.target.value)} /></div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">APPEARANCE</div></div>
          <div className="form-group">
            <label className="form-label">Theme</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={`btn ${darkMode ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setDarkMode(true); updateSetting('dark_mode', 'true'); }} style={{ letterSpacing: 1 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg> DARK
              </button>
              <button className={`btn ${!darkMode ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setDarkMode(false); updateSetting('dark_mode', 'false'); }} style={{ letterSpacing: 1 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/></svg> LIGHT
              </button>
            </div>
          </div>
          <div style={{ marginTop: 20, padding: 16, background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 1 }}>APPLICATION INFO</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ color: 'var(--text-muted)' }}>VERSION</span><span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>1.0.0</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ color: 'var(--text-muted)' }}>PLATFORM</span><span style={{ color: 'var(--text-primary)' }}>Windows</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>DATABASE</span><span style={{ color: 'var(--text-primary)' }}>SQLite</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
