import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';

export default function NotesLibrary() {
  const { apiBase } = useApp();
  const [notes, setNotes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('date');
  const [showUpload, setShowUpload] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [noteName, setNoteName] = useState('');
  const [noteCategory, setNoteCategory] = useState('Uncategorized');
  const [catForm, setCatForm] = useState({ name: '', color: '#7c5cbf' });
  const [catError, setCatError] = useState('');

  useEffect(() => { fetchNotes(); fetchCategories(); }, [search, category, sort]);

  const fetchNotes = async () => { try { const params = new URLSearchParams(); if (search) params.set('search', search); if (category !== 'All') params.set('category', category); params.set('sort', sort); const res = await fetch(`${apiBase}/api/notes?${params}`); setNotes(await res.json()); } catch (err) { console.error(err); } };
  const fetchCategories = async () => { try { const res = await fetch(`${apiBase}/api/notes/categories`); setCategories(await res.json()); } catch (err) { console.error(err); } };

  const uploadNote = async () => {
    if (!selectedFile) return;
    const fd = new FormData();
    fd.append('file', selectedFile);
    fd.append('name', noteName || selectedFile.name);
    fd.append('category', noteCategory);
    try { await fetch(`${apiBase}/api/upload-notes`, { method: 'POST', body: fd }); setShowUpload(false); setSelectedFile(null); setNoteName(''); fetchNotes(); } catch (err) { alert('Upload failed'); }
  };

  const deleteNote = async (id) => { if (!confirm('Delete this note?')) return; await fetch(`${apiBase}/api/notes/${id}`, { method: 'DELETE' }); fetchNotes(); };

  const addCategory = async () => {
    if (!catForm.name.trim()) return;
    setCatError('');
    try {
      const res = await fetch(`${apiBase}/api/notes/categories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(catForm) });
      const data = await res.json();
      if (!res.ok) { setCatError(data.error || 'Failed'); return; }
      setShowCategoryModal(false); setCatForm({ name: '', color: '#6b8c42' }); setCatError(''); fetchCategories();
    } catch (err) { setCatError('Network error'); }
  };

  const deleteCategory = async (id) => { if (!confirm('Delete this category?')) return; await fetch(`${apiBase}/api/notes/categories/${id}`, { method: 'DELETE' }); fetchCategories(); };

  const formatSize = (bytes) => { if (bytes < 1024) return bytes + ' B'; if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'; return (bytes / (1024 * 1024)).toFixed(1) + ' MB'; };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: 1, textTransform: 'uppercase' }}>NOTES LIBRARY</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{notes.length} documents available</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowCategoryModal(true)} style={{ letterSpacing: 1 }}>ADD CATEGORY</button>
          <button className="btn btn-primary" onClick={() => setShowUpload(true)} style={{ letterSpacing: 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            UPLOAD PDF
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input className="input" placeholder="Search notes..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32, width: 250 }} /></div>
        <div className="tabs">
          {['All', ...categories.map(c => c.name)].map(cat => (<button key={cat} className={`tab ${category === cat ? 'active' : ''}`} onClick={() => setCategory(cat)}>{cat.toUpperCase()}</button>))}
        </div>
        <select className="select" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="date">Latest First</option>
          <option value="name">Name (A-Z)</option>
          <option value="downloads">Most Downloaded</option>
        </select>
      </div>

      <div className="grid-4">
        {notes.map(note => (
          <div key={note.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'rgba(124,92,191,0.06)', border: '1px solid rgba(124,92,191,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>PDF</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>{formatSize(note.file_size)}</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><span style={{ color: 'var(--text-muted)', letterSpacing: 0.5 }}>CATEGORY</span><span style={{ color: 'var(--text-primary)' }}>{note.category}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><span style={{ color: 'var(--text-muted)', letterSpacing: 0.5 }}>DOWNLOADS</span><span style={{ color: 'var(--text-primary)' }}>{note.downloads}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)', letterSpacing: 0.5 }}>UPLOADED</span><span style={{ color: 'var(--text-primary)' }}>{note.uploaded_at ? new Date(note.uploaded_at).toLocaleDateString() : '-'}</span></div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-sm btn-primary" onClick={() => window.open(`${apiBase}/api/notes/${note.id}/preview`, '_blank')} style={{ flex: 1, justifyContent: 'center', letterSpacing: 1 }}>PRINT</button>
              <a className="btn btn-sm btn-secondary" href={`${apiBase}/api/notes/${note.id}/download`} download style={{ textDecoration: 'none', flex: 1, justifyContent: 'center', letterSpacing: 1 }}>DOWNLOAD</a>
              <button className="btn btn-sm btn-danger" onClick={() => deleteNote(note.id)}>DEL</button>
            </div>
          </div>
        ))}
      </div>

      {notes.length === 0 && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="60" height="60"><path d="M14,2 L6,2 C4.9,2 4,2.9 4,4 L4,20 C4,21.1 4.9,22 6,22 L18,22 C19.1,22 20,21.1 20,20 L20,8 Z"/><polyline points="14,2 14,8 20,8"/></svg>
          <h3>NO NOTES YET</h3>
          <p>Upload PDF documents to the Notes Library</p>
        </div>
      )}

      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">UPLOAD PDF</div>
            <div className="form-group"><label className="form-label">File</label><input type="file" accept=".pdf" onChange={e => setSelectedFile(e.target.files[0])} style={{ fontSize: 12 }} /></div>
            <div className="form-group"><label className="form-label">Name</label><input className="input" style={{ width: '100%' }} value={noteName} onChange={e => setNoteName(e.target.value)} placeholder="Document name" /></div>
            <div className="form-group"><label className="form-label">Category</label><select className="select" style={{ width: '100%' }} value={noteCategory} onChange={e => setNoteCategory(e.target.value)}><option value="Uncategorized">Uncategorized</option>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
            <div className="form-actions"><button className="btn btn-secondary" onClick={() => setShowUpload(false)}>CANCEL</button><button className="btn btn-primary" onClick={uploadNote}>UPLOAD</button></div>
          </div>
        </div>
      )}

      {showCategoryModal && (
        <div className="modal-overlay" onClick={() => { setShowCategoryModal(false); setCatError(''); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">ADD CATEGORY</div>
            <div className="form-group"><label className="form-label">Category Name</label><input className="input" style={{ width: '100%' }} value={catForm.name} onChange={e => { setCatForm({ ...catForm, name: e.target.value }); setCatError(''); }} placeholder="e.g. Semester 1" onKeyDown={e => { if (e.key === 'Enter') addCategory(); }} autoFocus /></div>
            {catError && <div style={{ background: 'rgba(168,64,88,0.06)', border: '1px solid rgba(168,64,88,0.12)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: 'var(--error)', fontSize: 12, marginBottom: 12, fontFamily: 'var(--font-display)' }}>{catError}</div>}
            <div className="form-group"><label className="form-label">Color</label><input type="color" value={catForm.color} onChange={e => setCatForm({ ...catForm, color: e.target.value })} /></div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 1 }}>EXISTING CATEGORIES</div>
              {categories.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 12, height: 12, borderRadius: 2, background: c.color }} /><span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{c.name}</span></div>
                  <button className="btn btn-sm btn-danger" onClick={() => deleteCategory(c.id)}>DEL</button>
                </div>
              ))}
            </div>
            <div className="form-actions"><button className="btn btn-secondary" onClick={() => { setShowCategoryModal(false); setCatError(''); }}>CLOSE</button><button className="btn btn-primary" onClick={addCategory}>ADD</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
