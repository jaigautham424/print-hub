const express = require('express');
const http = require('http');
const { Server: SocketIO } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const bonjour = require('bonjour')();
const { initializeDatabase, saveDb, queryAll, queryOne, runSql, DATA_DIR } = require('../database/schema');
const { getLocalIP, getNetworkName } = require('../utils/network');
const { detectPrinters } = require('../utils/printers');

let io;
let server;
let mainWindow;
let serverRunning = false;
let isStarting = false;
let connectedDevices = new Map();
let routesRegistered = false;
let bonjourService = null;

function generateDocumentToken() {
  let token;
  for (let i = 0; i < 10; i++) {
    token = String(Math.floor(1000 + Math.random() * 9000));
    const existing = queryOne("SELECT id FROM print_jobs WHERE document_token = ?", [token]);
    if (!existing) return token;
  }
  return token;
}

const app = express();
let httpServer;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(DATA_DIR, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.txt', '.webp', '.heic'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('File type "' + ext + '" not allowed. Supported: ' + allowed.join(', ')));
    }
  },
});

const notesStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(DATA_DIR, 'notes-library');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const notesUpload = multer({
  storage: notesStorage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, file.originalname.toLowerCase().endsWith('.pdf'));
  },
});

let PORT = process.env.PORT || 3000;

function log(level, category, message, details = null) {
  runSql('INSERT INTO server_logs (level, category, message, details) VALUES (?, ?, ?, ?)', [level, category, message, details ? JSON.stringify(details) : null]);
}

function logActivity(eventType, data) {
  runSql('INSERT INTO activity_log (event_type, event_data, device_id, device_name, ip_address) VALUES (?, ?, ?, ?, ?)', [eventType, JSON.stringify(data), data.device_id || null, data.device_name || null, data.ip || null]);
  if (io) io.emit('activity', { type: eventType, data, time: new Date().toISOString() });
}

function broadcastStats() {
  if (!io) return;
  const stats = getDashboardStats();
  io.emit('stats', stats);
}

function getDashboardStats() {
  const today = new Date().toISOString().split('T')[0];
  const totalDevices = (queryOne('SELECT COUNT(*) as c FROM devices') || {}).c || 0;
  const onlineDevices = (queryOne("SELECT COUNT(*) as c FROM devices WHERE status != 'offline'") || {}).c || 0;
  const offlineDevices = totalDevices - onlineDevices;
  const totalPrinters = (queryOne('SELECT COUNT(*) as c FROM printers') || {}).c || 0;
  const activePrinting = (queryOne("SELECT COUNT(*) as c FROM printers WHERE status = 'printing'") || {}).c || 0;
  const totalJobsToday = (queryOne("SELECT COUNT(*) as c FROM print_jobs WHERE date(upload_time) = ?", [today]) || {}).c || 0;
  const totalPagesToday = (queryOne("SELECT COALESCE(SUM(pages_printed), 0) as c FROM print_jobs WHERE date(upload_time) = ? AND status = 'completed'", [today]) || {}).c || 0;
  const activeQueue = (queryOne("SELECT COUNT(*) as c FROM print_jobs WHERE status IN ('uploading','processing','waiting','printing')") || {}).c || 0;
  const completedJobs = (queryOne("SELECT COUNT(*) as c FROM print_jobs WHERE status = 'completed'") || {}).c || 0;
  const failedJobs = (queryOne("SELECT COUNT(*) as c FROM print_jobs WHERE status = 'error'") || {}).c || 0;
  const recentJobs = queryAll('SELECT * FROM print_jobs ORDER BY upload_time DESC LIMIT 20');
  const activePrinters = queryAll("SELECT * FROM printers WHERE enabled = 1 AND status != 'disabled'");

  return { totalDevices, onlineDevices, offlineDevices, totalPrinters, activePrinting, totalJobsToday, totalPagesToday, activeQueue, completedJobs, failedJobs, recentJobs, activePrinters };
}

async function startServer(mainWin) {
  if (serverRunning) return;
  if (isStarting) throw new Error('Server is already starting');
  isStarting = true;
  mainWindow = mainWin;
  await initializeDatabase();

  // Ensure upload dirs exist
  const uploadDir = path.join(DATA_DIR, 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  syncPrinters();

  if (!routesRegistered) {
    routesRegistered = true;

  app.get('/api/status', (req, res) => {
    const ip = getLocalIP();
    const network = getNetworkName();
    res.json({ running: serverRunning, ip, network, port: PORT, url: `http://${ip}:${PORT}` });
  });

  // ===== SERVER CONTROL (standalone mode) =====

  app.post('/api/server/start', async (req, res) => {
    if (serverRunning) return res.json({ running: true, message: 'Server already running' });
    try {
      await startServer(mainWindow);
      res.json({ running: true, message: 'Server started' });
    } catch (err) {
      res.status(500).json({ running: false, message: err.message });
    }
  });

  app.post('/api/server/stop', async (req, res) => {
    if (!serverRunning) return res.json({ running: false, message: 'Server not running' });
    try {
      await stopServer();
      res.json({ running: false, message: 'Server stopped' });
    } catch (err) {
      res.status(500).json({ running: false, message: err.message });
    }
  });

  app.post('/api/server/restart', async (req, res) => {
    try {
      if (serverRunning) await stopServer();
      await startServer(mainWindow);
      res.json({ running: true, message: 'Server restarted' });
    } catch (err) {
      res.status(500).json({ running: false, message: err.message });
    }
  });

  app.get('/api/ip', (req, res) => {
    const ip = getLocalIP();
    res.json({ ip, port: PORT, url: `http://${ip}:${PORT}`, clientUrl: `http://${ip}:${PORT}/client` });
  });

  app.get('/api/qr-code', async (req, res) => {
    const ip = getLocalIP();
    const clientUrl = `http://${ip}:${PORT}/client`;
    try {
      const qr = await QRCode.toDataURL(clientUrl, {
        width: 300,
        margin: 2,
        color: { dark: '#1e293b', light: '#ffffff' },
      });
      res.json({ qr, url: clientUrl, ip, port: PORT });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===== MOBILE APP SUPPORT =====

  app.get('/api/station/info', (req, res) => {
    const ip = getLocalIP();
    const network = getNetworkName();
    res.json({
      stationId: 'PRINTHUB-' + ip.replace(/\./g, '-'),
      ip,
      port: PORT,
      network,
      url: `http://${ip}:${PORT}`,
      status: 'online',
      version: '1.0.0',
    });
  });

  app.get('/api/station/qr', async (req, res) => {
    const ip = getLocalIP();
    const network = getNetworkName();
    const stationId = 'PRINTHUB-' + ip.replace(/\./g, '-');
    const stationUrl = `http://${ip}:${PORT}/client`;
    try {
      const qr = await QRCode.toDataURL(stationUrl, {
        width: 300,
        margin: 2,
        color: { dark: '#1e293b', light: '#ffffff' },
      });
      res.json({ qr, payload: stationUrl, stationId, ip, port: PORT, ssid: network, url: stationUrl });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/dashboard', (req, res) => {
    res.json(getDashboardStats());
  });

  // ===== DEVICES =====

  app.get('/api/devices', (req, res) => {
    res.json(queryAll('SELECT * FROM devices ORDER BY connection_time DESC'));
  });

  // ===== PRINTERS =====

  app.get('/api/printers', (req, res) => {
    res.json(queryAll('SELECT * FROM printers ORDER BY is_default DESC, name ASC'));
  });

  app.post('/api/printers/sync', (req, res) => {
    syncPrinters();
    res.json(queryAll('SELECT * FROM printers ORDER BY is_default DESC, name ASC'));
  });

  app.post('/api/printers/:id/toggle', (req, res) => {
    const printer = queryOne('SELECT * FROM printers WHERE id = ?', [req.params.id]);
    if (!printer) return res.status(404).json({ error: 'Printer not found' });
    const newEnabled = printer.enabled ? 0 : 1;
    const newStatus = newEnabled ? 'idle' : 'disabled';
    runSql('UPDATE printers SET enabled = ?, status = ? WHERE id = ?', [newEnabled, newStatus, req.params.id]);
    const updated = queryOne('SELECT * FROM printers WHERE id = ?', [req.params.id]);
    if (io) io.emit('printer-updated', updated);
    res.json(updated);
  });

  app.post('/api/printers/:id/set-default', (req, res) => {
    runSql('UPDATE printers SET is_default = 0');
    runSql('UPDATE printers SET is_default = 1 WHERE id = ?', [req.params.id]);
    if (io) broadcastStats();
    res.json({ success: true });
  });

  // ===== UPLOAD & JOBS =====

  app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
      const jobId = uuidv4();
      const documentToken = generateDocumentToken();
      const deviceIP = req.ip || req.connection.remoteAddress || '127.0.0.1';
      const deviceName = req.body.device_name || 'Unknown Device';
      const userName = req.body.user_name || 'Guest';
      const defaultPrinter = queryOne("SELECT id FROM printers WHERE is_default = 1 LIMIT 1");
      const printerId = req.body.printer_id || (defaultPrinter ? defaultPrinter.id : null);
      const totalPages = parseInt(req.body.total_pages) || 1;
      const copies = parseInt(req.body.copies) || 1;
      const colorMode = req.body.color_mode || 'bw';
      const duplexMode = req.body.duplex_mode || 'single';
      const paperSize = req.body.paper_size || 'A4';
      const priority = parseInt(req.body.priority) || 5;

      // Ensure device exists
      let device = queryOne('SELECT * FROM devices WHERE ip_address = ?', [deviceIP]);
      if (!device) {
        const devId = uuidv4();
        runSql('INSERT INTO devices (id, name, ip_address, status) VALUES (?, ?, ?, ?)', [devId, deviceName, deviceIP, 'online']);
        device = { id: devId, name: deviceName, ip_address: deviceIP };
      } else {
        runSql("UPDATE devices SET last_activity = CURRENT_TIMESTAMP, status = 'online' WHERE id = ?", [device.id]);
      }

      runSql(`INSERT INTO print_jobs (id, device_id, printer_id, user_name, device_name, file_name, original_name, file_path, file_size, total_pages, copies, color_mode, duplex_mode, paper_size, priority, status, document_token)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting', ?)`,
        [jobId, device.id, printerId, userName, deviceName, req.file.filename, req.file.originalname, req.file.path, req.file.size, totalPages, copies, colorMode, duplexMode, paperSize, priority, documentToken]);

      if (printerId) {
        const queueLen = (queryOne("SELECT COUNT(*) as c FROM print_jobs WHERE printer_id = ? AND status IN ('waiting','printing')", [printerId]) || {}).c || 0;
        runSql('UPDATE printers SET queue_length = ? WHERE id = ?', [queueLen, printerId]);
      }

      logActivity('file_uploaded', { job_id: jobId, file_name: req.file.originalname, user: userName, device_name: deviceName, ip: deviceIP });
      log('info', 'upload', `File uploaded: ${req.file.originalname} by ${userName}`, { jobId });

      if (io) { io.emit('new-job', { jobId, status: 'waiting' }); broadcastStats(); }
      res.json({ jobId, documentToken, status: 'waiting', message: 'File uploaded and queued' });
    } catch (err) {
      console.error('Upload error:', err);
      log('error', 'upload', `Upload failed: ${err.message}`);
      res.status(500).json({ error: 'Upload failed: ' + err.message });
    }
  }, (err, req, res, next) => {
    // Multer error handler
    console.error('Multer error:', err);
    log('error', 'upload', `Multer error: ${err.message}`);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum size is 100MB.' });
    }
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  });

  // ===== NOTES =====

  app.post('/api/upload-notes', notesUpload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const noteId = uuidv4();
    const name = req.body.name || req.file.originalname;
    const category = req.body.category || 'Uncategorized';
    runSql('INSERT INTO notes_library (id, name, file_name, file_path, file_size, category) VALUES (?, ?, ?, ?, ?, ?)', [noteId, name, req.file.filename, req.file.path, req.file.size, category]);
    logActivity('note_uploaded', { note_id: noteId, name, category });
    if (io) io.emit('notes-updated');
    res.json({ id: noteId, message: 'Note uploaded' });
  });

  app.get('/api/notes', (req, res) => {
    const { search, category, sort } = req.query;
    let sql = 'SELECT * FROM notes_library WHERE 1=1';
    const params = [];
    if (search) { sql += ' AND (name LIKE ? OR tags LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (category && category !== 'All') { sql += ' AND category = ?'; params.push(category); }
    if (sort === 'name') sql += ' ORDER BY name ASC';
    else if (sort === 'downloads') sql += ' ORDER BY downloads DESC';
    else sql += ' ORDER BY uploaded_at DESC';
    res.json(queryAll(sql, params));
  });

  app.get('/api/notes/categories', (req, res) => {
    res.json(queryAll('SELECT * FROM notes_categories ORDER BY sort_order'));
  });

  app.post('/api/notes/categories', (req, res) => {
    const id = uuidv4();
    const { name, description, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const existing = queryOne('SELECT id FROM notes_categories WHERE name = ?', [name.trim()]);
    if (existing) {
      return res.status(409).json({ error: 'Category "' + name.trim() + '" already exists' });
    }
    runSql('INSERT INTO notes_categories (id, name, description, color) VALUES (?, ?, ?, ?)', [id, name.trim(), description || '', color || '#6366f1']);
    if (io) io.emit('notes-updated');
    res.json({ id, message: 'Category created' });
  });

  app.delete('/api/notes/categories/:id', (req, res) => {
    runSql('DELETE FROM notes_categories WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  app.put('/api/notes/:id', (req, res) => {
    const { name, category } = req.body;
    if (name) runSql('UPDATE notes_library SET name = ? WHERE id = ?', [name, req.params.id]);
    if (category) runSql('UPDATE notes_library SET category = ? WHERE id = ?', [category, req.params.id]);
    if (io) io.emit('notes-updated');
    res.json({ success: true });
  });

  app.delete('/api/notes/:id', (req, res) => {
    const note = queryOne('SELECT file_path FROM notes_library WHERE id = ?', [req.params.id]);
    if (note && fs.existsSync(note.file_path)) fs.unlinkSync(note.file_path);
    runSql('DELETE FROM notes_library WHERE id = ?', [req.params.id]);
    if (io) io.emit('notes-updated');
    res.json({ success: true });
  });

  app.get('/api/notes/:id/download', (req, res) => {
    const note = queryOne('SELECT * FROM notes_library WHERE id = ?', [req.params.id]);
    if (!note) return res.status(404).json({ error: 'Not found' });
    runSql('UPDATE notes_library SET downloads = downloads + 1, last_accessed = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    if (fs.existsSync(note.file_path)) res.download(note.file_path, note.file_name);
    else res.status(404).json({ error: 'File not found on disk' });
  });

  // ===== JOBS =====

  app.get('/api/jobs', (req, res) => {
    const { status, printer_id } = req.query;
    let sql = 'SELECT * FROM print_jobs WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (printer_id) { sql += ' AND printer_id = ?'; params.push(printer_id); }
    sql += ' ORDER BY priority DESC, upload_time ASC';
    res.json(queryAll(sql, params));
  });

  app.post('/api/jobs/:id/pause', (req, res) => {
    runSql("UPDATE print_jobs SET status = 'waiting' WHERE id = ? AND status = 'printing'", [req.params.id]);
    if (io) { io.emit('job-updated', { id: req.params.id }); broadcastStats(); }
    res.json({ success: true });
  });

  app.post('/api/jobs/:id/resume', (req, res) => {
    runSql("UPDATE print_jobs SET status = 'printing' WHERE id = ? AND status = 'waiting'", [req.params.id]);
    if (io) { io.emit('job-updated', { id: req.params.id }); broadcastStats(); }
    res.json({ success: true });
  });

  app.post('/api/jobs/:id/cancel', (req, res) => {
    runSql("UPDATE print_jobs SET status = 'cancelled' WHERE id = ? AND status NOT IN ('completed','cancelled')", [req.params.id]);
    const job = queryOne('SELECT * FROM print_jobs WHERE id = ?', [req.params.id]);
    if (job && job.file_path && fs.existsSync(job.file_path)) {
      const cancelledDir = path.join(DATA_DIR, 'cancelled-jobs');
      if (!fs.existsSync(cancelledDir)) fs.mkdirSync(cancelledDir, { recursive: true });
      try { fs.renameSync(job.file_path, path.join(cancelledDir, job.file_name)); } catch (e) {}
    }
    logActivity('print_failed', { job_id: req.params.id });
    if (io) { io.emit('job-cancelled', { id: req.params.id }); broadcastStats(); }
    res.json({ success: true });
  });

  app.post('/api/jobs/:id/complete', (req, res) => {
    runSql("UPDATE print_jobs SET status = 'completed', pages_printed = total_pages, finish_time = CURRENT_TIMESTAMP WHERE id = ?", [req.params.id]);
    const job = queryOne('SELECT * FROM print_jobs WHERE id = ?', [req.params.id]);
    if (job && job.file_path && fs.existsSync(job.file_path)) {
      const completedDir = path.join(DATA_DIR, 'completed-jobs');
      if (!fs.existsSync(completedDir)) fs.mkdirSync(completedDir, { recursive: true });
      try { fs.renameSync(job.file_path, path.join(completedDir, job.file_name)); } catch (e) {}
    }
    logActivity('print_completed', { job_id: req.params.id, pages: job ? job.total_pages : 0 });
    if (io) { io.emit('job-completed', { id: req.params.id }); broadcastStats(); }
    res.json({ success: true });
  });

  app.post('/api/jobs/:id/move', (req, res) => {
    runSql('UPDATE print_jobs SET printer_id = ? WHERE id = ?', [req.body.printer_id, req.params.id]);
    if (io) io.emit('job-updated', { id: req.params.id });
    res.json({ success: true });
  });

  app.post('/api/jobs/:id/reorder', (req, res) => {
    runSql('UPDATE print_jobs SET priority = ? WHERE id = ?', [req.body.priority, req.params.id]);
    if (io) io.emit('job-updated', { id: req.params.id });
    res.json({ success: true });
  });

  // ===== SCHEDULED =====

  app.get('/api/scheduled', (req, res) => {
    res.json(queryAll('SELECT * FROM scheduled_jobs ORDER BY scheduled_time ASC'));
  });

  app.post('/api/scheduled', notesUpload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const id = uuidv4();
    runSql(`INSERT INTO scheduled_jobs (id, job_name, file_name, file_path, file_size, total_pages, copies, color_mode, duplex_mode, paper_size, printer_id, user_name, scheduled_time, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.body.job_name || req.file.originalname, req.file.originalname, req.file.path, req.file.size,
        parseInt(req.body.total_pages) || 1, parseInt(req.body.copies) || 1, req.body.color_mode || 'bw',
        req.body.duplex_mode || 'single', req.body.paper_size || 'A4', req.body.printer_id || null,
        req.body.user_name || 'admin', req.body.scheduled_time, req.body.notes || '']);
    if (io) io.emit('scheduled-updated');
    res.json({ id, message: 'Scheduled' });
  });

  app.post('/api/scheduled/:id/cancel', (req, res) => {
    runSql("UPDATE scheduled_jobs SET status = 'cancelled' WHERE id = ?", [req.params.id]);
    if (io) io.emit('scheduled-updated');
    res.json({ success: true });
  });

  app.delete('/api/scheduled/:id', (req, res) => {
    const job = queryOne('SELECT file_path FROM scheduled_jobs WHERE id = ?', [req.params.id]);
    if (job && fs.existsSync(job.file_path)) fs.unlinkSync(job.file_path);
    runSql('DELETE FROM scheduled_jobs WHERE id = ?', [req.params.id]);
    if (io) io.emit('scheduled-updated');
    res.json({ success: true });
  });

  // ===== SETTINGS =====

  app.get('/api/settings', (req, res) => {
    const rows = queryAll('SELECT * FROM settings');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  });

  app.put('/api/settings', (req, res) => {
    for (const [key, value] of Object.entries(req.body)) {
      const existing = queryOne('SELECT key FROM settings WHERE key = ?', [key]);
      if (existing) {
        runSql('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?', [String(value), key]);
      } else {
        runSql('INSERT INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
      }
    }
    res.json({ success: true });
  });

  // ===== REPORTS =====

  app.get('/api/reports/daily', (req, res) => {
    const days = parseInt(req.query.days) || 30;
    res.json(queryAll(`SELECT date(upload_time) as date, COUNT(*) as jobs, COALESCE(SUM(pages_printed), 0) as pages FROM print_jobs WHERE upload_time >= date('now', '-' || ? || ' days') GROUP BY date(upload_time) ORDER BY date ASC`, [days]));
  });

  app.get('/api/reports/printers', (req, res) => {
    res.json(queryAll(`SELECT p.name, COUNT(j.id) as jobs, COALESCE(SUM(j.pages_printed), 0) as pages FROM printers p LEFT JOIN print_jobs j ON p.id = j.printer_id GROUP BY p.name ORDER BY pages DESC`));
  });

  app.get('/api/reports/users', (req, res) => {
    res.json(queryAll(`SELECT user_name, COUNT(*) as jobs, COALESCE(SUM(pages_printed), 0) as pages FROM print_jobs GROUP BY user_name ORDER BY jobs DESC LIMIT 20`));
  });

  app.get('/api/reports/documents', (req, res) => {
    res.json(queryAll(`SELECT original_name, COUNT(*) as print_count, COALESCE(SUM(total_pages), 0) as total_pages FROM print_jobs GROUP BY original_name ORDER BY print_count DESC LIMIT 20`));
  });

  // ===== LOGS =====

  app.get('/api/logs', (req, res) => {
    const { level, category, search, limit = 100 } = req.query;
    let sql = 'SELECT * FROM server_logs WHERE 1=1';
    const params = [];
    if (level) { sql += ' AND level = ?'; params.push(level); }
    if (category) { sql += ' AND category = ?'; params.push(category); }
    if (search) { sql += ' AND message LIKE ?'; params.push(`%${search}%`); }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    res.json(queryAll(sql, params));
  });

  app.get('/api/logs/activity', (req, res) => {
    res.json(queryAll('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 100'));
  });

  // Static files
  app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads')));
  app.use('/notes', express.static(path.join(DATA_DIR, 'notes-library')));

  // Serve frontend in standalone mode
  const frontendPath = path.join(__dirname, '../../release/frontend');
  if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
  }

  // ===== PRINT FILE ENDPOINT (serves file inline) =====
  app.get('/api/jobs/:id/file', (req, res) => {
    const job = queryOne('SELECT * FROM print_jobs WHERE id = ?', [req.params.id]);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (!job.file_path || !fs.existsSync(job.file_path)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }
    const ext = path.extname(job.original_name).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.png': 'image/png', '.gif': 'image/gif',
      '.bmp': 'image/bmp', '.webp': 'image/webp',
      '.txt': 'text/plain', '.html': 'text/html',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.tiff': 'image/tiff', '.tif': 'image/tiff',
      '.heic': 'image/heic'
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const isInline = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.txt', '.tiff', '.tif'].includes(ext);
    const disposition = isInline ? 'inline' : 'attachment';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${job.original_name}"`);
    fs.createReadStream(job.file_path).pipe(res);
  });

  // ===== PREVIEW ENDPOINT (shows file in viewer) =====
  app.get('/api/jobs/:id/preview', (req, res) => {
    const job = queryOne('SELECT * FROM print_jobs WHERE id = ?', [req.params.id]);
    if (!job) return res.status(404).send('Job not found');
    if (!job.file_path || !fs.existsSync(job.file_path)) {
      return res.status(404).send('File not found on disk');
    }
    const fileUrl = `/api/jobs/${job.id}/file`;
    const ext = path.extname(job.original_name).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext);
    const isPdf = ext === '.pdf';

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${job.original_name} - Preview</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0f172a;color:#f1f5f9;height:100vh;display:flex;flex-direction:column}
.toolbar{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#1e293b;border-bottom:1px solid #334155;flex-shrink:0}
.toolbar-left{display:flex;align-items:center;gap:12px;min-width:0}
.toolbar-title{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:300px}
.toolbar-meta{font-size:11px;color:#94a3b8}
.toolbar-right{display:flex;gap:8px;flex-shrink:0}
.btn{padding:8px 16px;border-radius:8px;font-size:12px;font-weight:600;border:none;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:6px;text-decoration:none}
.btn-print{background:linear-gradient(135deg,#6366f1,#818cf8);color:white}
.btn-print:hover{box-shadow:0 4px 12px rgba(99,102,241,.3)}
.btn-download{background:#0f172a;border:1px solid #334155;color:#f1f5f9}
.btn-download:hover{border-color:#6366f1}
.btn-back{background:none;border:1px solid #334155;color:#94a3b8;border-radius:8px;padding:8px 12px;text-decoration:none;font-size:12px;font-weight:500;display:inline-flex;align-items:center;gap:4px}
.btn-back:hover{border-color:#6366f1;color:#f1f5f9}
.viewer-wrap{flex:1;overflow:hidden;background:#1a1a2e}
.viewer-wrap iframe{width:100%;height:100%;border:none}
.viewer-wrap img{max-width:100%;max-height:100%;object-fit:contain;display:block;margin:auto;padding:20px}
.empty-preview{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#94a3b8}
</style>
</head>
<body>
<div class="toolbar">
  <div class="toolbar-left">
    <a href="javascript:history.back()" class="btn-back"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,18 9,12 15,6"/></svg> Back</a>
    <div>
      <div class="toolbar-title">${job.original_name}</div>
      <div class="toolbar-meta">${job.user_name || 'Guest'} &bull; ${(job.file_size / 1024).toFixed(1)} KB &bull; ${job.total_pages || 1} pages</div>
    </div>
  </div>
  <div class="toolbar-right">
    <a href="${fileUrl}" download="${job.original_name}" class="btn btn-download"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download</a>
    <a href="${fileUrl}" target="_blank" class="btn btn-print"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Print</a>
  </div>
</div>
<div class="viewer-wrap">
  ${isPdf ? '<iframe src="' + fileUrl + '"></iframe>' : isImage ? '<img src="' + fileUrl + '" />' : '<div class="empty-preview"><p>Preview not available for this file type</p><p style="font-size:12px;color:#64748b;margin-top:8px">' + job.original_name + '</p><a href="' + fileUrl + '" download style="margin-top:16px;color:#818cf8;font-size:13px">Download file</a></div>'}
</div>
</body>
</html>`);
  });

  // ===== PRINT API ENDPOINTS =====

  app.get('/api/print/file/:jobId', (req, res) => {
    const job = queryOne('SELECT * FROM print_jobs WHERE id = ?', [req.params.jobId]);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (!job.file_path || !fs.existsSync(job.file_path)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }
    const ext = path.extname(job.original_name).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.png': 'image/png', '.gif': 'image/gif',
      '.bmp': 'image/bmp', '.webp': 'image/webp',
      '.txt': 'text/plain', '.html': 'text/html',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.tiff': 'image/tiff', '.tif': 'image/tiff',
      '.heic': 'image/heic'
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${job.original_name}"`);
    fs.createReadStream(job.file_path).pipe(res);
  });

  app.get('/api/print/job/:jobId', (req, res) => {
    const job = queryOne('SELECT * FROM print_jobs WHERE id = ?', [req.params.jobId]);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    const fileExists = job.file_path && fs.existsSync(job.file_path);
    res.json({ ...job, file_exists: fileExists, print_url: `/api/print/file/${job.id}` });
  });

  app.post('/api/print/:jobId/status', (req, res) => {
    const { status } = req.body;
    const allowed = ['waiting', 'printing', 'completed', 'error', 'cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const job = queryOne('SELECT * FROM print_jobs WHERE id = ?', [req.params.jobId]);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    runSql('UPDATE print_jobs SET status = ? WHERE id = ?', [status, req.params.jobId]);
    if (status === 'printing') {
      runSql("UPDATE print_jobs SET start_time = CURRENT_TIMESTAMP WHERE id = ?", [req.params.jobId]);
    } else if (status === 'completed') {
      runSql("UPDATE print_jobs SET pages_printed = total_pages, finish_time = CURRENT_TIMESTAMP WHERE id = ?", [req.params.jobId]);
    }
    if (io) { io.emit('job-updated', { id: req.params.jobId }); broadcastStats(); }
    logActivity('status_changed', { job_id: req.params.jobId, status });
    res.json({ success: true, status });
  });

  // ===== DOCUMENT PROCESSING =====

  app.get('/api/jobs/:id/process', (req, res) => {
    const job = queryOne('SELECT * FROM print_jobs WHERE id = ?', [req.params.id]);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (!job.file_path || !fs.existsSync(job.file_path)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    const ext = path.extname(job.original_name).toLowerCase();
    const isPdf = ext === '.pdf';
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif', '.heic'].includes(ext);
    const isDoc = ['.doc', '.docx'].includes(ext);
    const isText = ext === '.txt';

    const mimeTypes = {
      '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.png': 'image/png', '.gif': 'image/gif', '.bmp': 'image/bmp',
      '.webp': 'image/webp', '.txt': 'text/plain', '.tiff': 'image/tiff',
      '.tif': 'image/tiff', '.heic': 'image/heic',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    const sizeKB = job.file_size / 1024;
    const sizeMB = job.file_size / (1024 * 1024);
    const sizeStr = sizeMB >= 1 ? sizeMB.toFixed(1) + ' MB' : sizeKB.toFixed(1) + ' KB';

    let category = 'document';
    if (isPdf) category = 'pdf';
    else if (isImage) category = 'image';
    else if (isDoc) category = 'word';
    else if (isText) category = 'text';

    const processable = isPdf || isImage || isText;
    const canPreviewInline = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.txt'].includes(ext);

    const analysis = {
      job_id: job.id,
      file_name: job.original_name,
      file_size: job.file_size,
      file_size_display: sizeStr,
      file_type: ext.replace('.', '').toUpperCase(),
      mime_type: mimeTypes[ext] || 'application/octet-stream',
      category,
      is_pdf: isPdf,
      is_image: isImage,
      is_document: isDoc,
      is_text: isText,
      processable,
      can_preview_inline: canPreviewInline,
      total_pages: job.total_pages || 1,
      copies: job.copies || 1,
      color_mode: job.color_mode || 'bw',
      paper_size: job.paper_size || 'A4',
      duplex_mode: job.duplex_mode || 'single',
      status: job.status,
      user_name: job.user_name || 'Guest',
      device_name: job.device_name || 'Unknown',
      upload_time: job.upload_time,
      print_url: `/api/print/file/${job.id}`,
      preview_url: `/print/${job.id}`,
      recommendations: {
        paper_size: job.paper_size || 'A4',
        color_mode: job.color_mode || 'bw',
        copies: job.copies || 1,
        duplex: job.duplex_mode === 'duplex' ? 'Recommended for multi-page documents' : 'Single-sided',
      },
    };

    if (isImage) {
      analysis.recommendations.color_mode = 'color';
      analysis.recommendations.note = 'Image detected — color printing recommended for best quality';
    } else if (isPdf) {
      analysis.recommendations.note = 'PDF document — review pages before printing';
    } else if (isDoc) {
      analysis.recommendations.note = 'Word document — convert to PDF for best print quality';
    }

    logActivity('document_analyzed', { job_id: job.id, file_type: ext, category });
    res.json(analysis);
  });

  // ===== DEDICATED PRINT PAGE =====

  app.get('/print/:jobId', (req, res) => {
    const job = queryOne('SELECT * FROM print_jobs WHERE id = ?', [req.params.jobId]);
    if (!job) return res.status(404).send('Job not found');
    const fileExists = job.file_path && fs.existsSync(job.file_path);
    if (!fileExists) return res.status(404).send('File not found on disk');
    const fileUrl = `/api/print/file/${job.id}`;
    const ext = path.extname(job.original_name).toLowerCase();
    const isPdf = ext === '.pdf';
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext);
    const sizeStr = job.file_size < 1024*1024 ? (job.file_size/1024).toFixed(1)+' KB' : (job.file_size/(1024*1024)).toFixed(1)+' MB';
    const colorLabel = job.color_mode === 'color' ? 'Color' : 'Black & White';
    const statusColor = job.status === 'completed' ? '#22c55e' : job.status === 'printing' ? '#fbbf24' : job.status === 'error' ? '#ef4444' : '#818cf8';
    const statusLabel = job.status.charAt(0).toUpperCase() + job.status.slice(1);

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Print - ${job.original_name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0f172a;color:#f1f5f9;height:100vh;display:flex;flex-direction:column}
.topbar{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;background:#1e293b;border-bottom:1px solid #334155;flex-shrink:0}
.topbar h1{font-size:16px;font-weight:700;background:linear-gradient(135deg,#6366f1,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.topbar-right{display:flex;gap:8px;align-items:center}
.btn{padding:8px 18px;border-radius:8px;font-size:13px;font-weight:600;border:none;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:6px;text-decoration:none}
.btn-back{background:none;border:1px solid #334155;color:#94a3b8;border-radius:8px;padding:8px 12px;font-size:12px}
.btn-back:hover{border-color:#6366f1;color:#f1f5f9}
.btn-print{background:linear-gradient(135deg,#6366f1,#818cf8);color:white;font-size:14px;padding:10px 24px}
.btn-print:hover{box-shadow:0 4px 16px rgba(99,102,241,.4);transform:translateY(-1px)}
.btn-open{background:#0f172a;border:1px solid #334155;color:#f1f5f9;font-size:13px;padding:10px 20px}
.btn-open:hover{border-color:#6366f1}
.main{flex:1;display:flex;overflow:hidden}
.sidebar{width:280px;flex-shrink:0;padding:20px;border-right:1px solid #334155;overflow-y:auto;background:#1e293b}
.sidebar h2{font-size:14px;font-weight:700;margin-bottom:16px;color:#f1f5f9}
.info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(51,65,85,.5)}
.info-label{font-size:12px;color:#94a3b8}
.info-value{font-size:12px;font-weight:600;color:#f1f5f9;text-align:right;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.status-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;background:rgba(99,102,241,.15);color:${statusColor};border:1px solid ${statusColor}33}
.status-dot{width:8px;height:8px;border-radius:50%;background:${statusColor}}
.settings-section{margin-top:20px}
.settings-section h3{font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px}
.setting-item{display:flex;justify-content:space-between;padding:6px 0;font-size:12px}
.setting-key{color:#94a3b8}
.setting-val{color:#f1f5f9;font-weight:500}
.pdf-viewer{flex:1;overflow:hidden;background:#1a1a2e}
.pdf-viewer iframe{width:100%;height:100%;border:none}
.img-viewer{flex:1;display:flex;align-items:center;justify-content:center;background:#1a1a2e;padding:20px}
.img-viewer img{max-width:100%;max-height:100%;object-fit:contain;border-radius:8px}
.bottom-bar{display:flex;align-items:center;justify-content:center;gap:12px;padding:14px 20px;background:#1e293b;border-top:1px solid #334155;flex-shrink:0}
.toast{position:fixed;top:20px;right:20px;background:#22c55e;color:white;padding:12px 20px;border-radius:8px;font-size:13px;font-weight:600;z-index:9999;display:none;animation:slideIn .3s}
@keyframes slideIn{from{transform:translateX(100px);opacity:0}to{transform:translateX(0);opacity:1}}
@media(max-width:768px){.sidebar{width:100%;border-right:none;border-bottom:1px solid #334155;max-height:40vh}.main{flex-direction:column}}
</style>
</head>
<body>
<div class="topbar">
  <a href="javascript:history.back()" class="btn btn-back"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,18 9,12 15,6"/></svg> Back</a>
  <h1>PRINT DOCUMENT</h1>
  <div class="topbar-right">
    <div class="status-badge"><span class="status-dot"></span>${statusLabel}</div>
  </div>
</div>
<div class="main">
  <div class="sidebar">
    <h2>File Details</h2>
    <div class="info-row"><span class="info-label">File</span><span class="info-value" title="${job.original_name}">${job.original_name}</span></div>
    <div class="info-row"><span class="info-label">User</span><span class="info-value">${job.user_name || 'Guest'}</span></div>
    <div class="info-row"><span class="info-label">Size</span><span class="info-value">${sizeStr}</span></div>
    <div class="info-row"><span class="info-label">Pages</span><span class="info-value">${job.total_pages || 1}</span></div>
    <div class="info-row"><span class="info-label">Uploaded</span><span class="info-value">${job.upload_time ? new Date(job.upload_time).toLocaleString() : '-'}</span></div>

    <div class="settings-section">
      <h3>Print Settings</h3>
      <div class="setting-item"><span class="setting-key">Copies</span><span class="setting-val">${job.copies || 1}</span></div>
      <div class="setting-item"><span class="setting-key">Color</span><span class="setting-val">${colorLabel}</span></div>
      <div class="setting-item"><span class="setting-key">Paper</span><span class="setting-val">${job.paper_size || 'A4'}</span></div>
      <div class="setting-item"><span class="setting-key">Duplex</span><span class="setting-val">${job.duplex_mode === 'duplex' ? 'Double-sided' : 'Single-sided'}</span></div>
    </div>

    <div class="settings-section">
      <h3>Actions</h3>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:4px">
        <button class="btn btn-open" onclick="window.open('${fileUrl}','_blank')" style="justify-content:center;width:100%"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> Open in Browser</button>
        <a href="${fileUrl}" download="${job.original_name}" class="btn btn-open" style="justify-content:center;width:100%;text-decoration:none"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download</a>
      </div>
    </div>
  </div>
  <div class="pdf-viewer" id="viewerArea">
    ${isPdf ? '<iframe src="'+fileUrl+'" id="pdfFrame"></iframe>' : isImage ? '<div class="img-viewer"><img src="'+fileUrl+'" /></div>' : '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#94a3b8"><p>Preview not available for this file type</p><p style="font-size:12px;color:#64748b;margin-top:8px">'+job.original_name+'</p></div>'}
  </div>
</div>
<div class="bottom-bar">
  <button class="btn btn-open" onclick="window.open('${fileUrl}','_blank')" style="font-size:13px;padding:10px 20px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> Open PDF in Browser</button>
  <button class="btn btn-print" onclick="printDocument()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> PRINT DOCUMENT</button>
</div>
<div class="toast" id="toast">Status updated</div>
<script>
async function printDocument() {
  // Try printing via iframe first (works for PDFs)
  var frame = document.getElementById('pdfFrame');
  if (frame) {
    try {
      frame.contentWindow.print();
      updateStatus('printing');
      return;
    } catch(e) {}
  }
  // Fallback: open file URL in new tab for browser print
  window.open('${fileUrl}', '_blank');
  updateStatus('printing');
}

async function updateStatus(status) {
  try {
    await fetch('/api/print/${job.id}/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: status })
    });
    var toast = document.getElementById('toast');
    toast.textContent = 'Status: ' + status.toUpperCase();
    toast.style.display = 'block';
    setTimeout(function() { toast.style.display = 'none'; }, 3000);
  } catch(e) {}
}
</script>
</body>
</html>`);
  });

  app.get('/api/notes/:id/preview', (req, res) => {
    const note = queryOne('SELECT * FROM notes_library WHERE id = ?', [req.params.id]);
    if (!note) return res.status(404).json({ error: 'Not found' });
    if (!note.file_path || !fs.existsSync(note.file_path)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${note.file_name}"`);
    fs.createReadStream(note.file_path).pipe(res);
  });

  // ===== CLIENT UPLOADS API =====
  app.get('/api/client-uploads', (req, res) => {
    const jobs = queryAll('SELECT id, original_name, user_name, device_name, status, total_pages, copies, color_mode, paper_size, upload_time, file_size, document_token FROM print_jobs ORDER BY upload_time DESC LIMIT 50');
    res.json(jobs);
  });

  // ===== DOCUMENT TOKEN TRACKING (for mobile) =====
  app.get('/api/track/:token', (req, res) => {
    const token = req.params.token;
    if (!/^\d{4}$/.test(token)) {
      return res.status(400).json({ error: 'Invalid token format. Must be 4 digits.' });
    }
    const job = queryOne('SELECT id, original_name, user_name, device_name, status, upload_time, total_pages, copies, color_mode, paper_size, document_token FROM print_jobs WHERE document_token = ?', [token]);
    if (!job) {
      return res.status(404).json({ error: 'Document not found for this token' });
    }
    res.json({
      documentToken: job.document_token,
      fileName: job.original_name,
      userName: job.user_name,
      deviceName: job.device_name,
      status: job.status,
      uploadTime: job.upload_time,
      totalPages: job.total_pages,
      copies: job.copies,
      colorMode: job.color_mode,
      paperSize: job.paper_size
    });
  });

  // ===== CLIENT SCHEDULE API =====
  app.get('/api/client/scheduled', (req, res) => {
    res.json(queryAll('SELECT id, job_name, file_name, status, scheduled_time, total_pages, copies, color_mode, paper_size, user_name, created_at FROM scheduled_jobs ORDER BY created_at DESC LIMIT 30'));
  });

  app.post('/api/client/schedule', notesUpload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const id = uuidv4();
    runSql(`INSERT INTO scheduled_jobs (id, job_name, file_name, file_path, file_size, total_pages, copies, color_mode, duplex_mode, paper_size, printer_id, user_name, scheduled_time, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.body.job_name || req.file.originalname, req.file.originalname, req.file.path, req.file.size,
        parseInt(req.body.total_pages) || 1, parseInt(req.body.copies) || 1, req.body.color_mode || 'bw',
        'single', req.body.paper_size || 'A4', req.body.printer_id || null,
        req.body.user_name || 'Guest', req.body.scheduled_time || null, req.body.notes || '']);
    if (io) io.emit('scheduled-updated');
    res.json({ id, message: 'Scheduled successfully' });
  });

  // ===== CLIENT LANDING PAGE =====
  app.get('/client', (req, res) => {
    const ip = getLocalIP();
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Print Hub</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0f172a;color:#f1f5f9;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.container{max-width:420px;width:100%}
.logo{text-align:center;margin-bottom:32px}
.logo h1{font-size:32px;font-weight:800;background:linear-gradient(135deg,#6366f1,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:6px}
.logo p{font-size:14px;color:#94a3b8}
.ip-badge{display:inline-flex;align-items:center;gap:6px;background:#1e293b;border:1px solid #334155;border-radius:20px;padding:6px 14px;margin-top:12px;font-size:12px;color:#94a3b8}
.ip-badge svg{width:14px;height:14px;color:#22c55e}
.ip-badge span{font-family:monospace;color:#f1f5f9;font-weight:600}
.ip-change{color:#fbbf24;font-size:10px;margin-top:6px;display:none}
.qr-wrap{text-align:center;margin-bottom:28px}
.qr-wrap img{border-radius:12px;border:2px solid #334155}
.qr-label{font-size:11px;color:#64748b;margin-top:6px}
.cards{display:flex;flex-direction:column;gap:16px}
.card-link{text-decoration:none;color:inherit}
.choice-card{background:#1e293b;border:1px solid #334155;border-radius:20px;padding:32px 24px;text-align:center;transition:all .3s;cursor:pointer}
.choice-card:hover{border-color:#6366f1;transform:translateY(-2px);box-shadow:0 8px 30px rgba(99,102,241,.15)}
.choice-icon{width:64px;height:64px;border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px}
.choice-icon.print{background:rgba(99,102,241,.15)}
.choice-icon.schedule{background:rgba(168,85,247,.15)}
.choice-card h2{font-size:20px;font-weight:700;margin-bottom:6px;color:#f1f5f9}
.choice-card p{font-size:13px;color:#94a3b8;line-height:1.5}
.footer-links{display:flex;justify-content:center;gap:16px;margin-top:32px}
.footer-links a{font-size:12px;color:#64748b;text-decoration:none;transition:color .2s}
.footer-links a:hover{color:#818cf8}
</style>
</head>
<body>
<div class="container">
  <div class="logo">
    <h1>Print Hub</h1>
    <p>Choose how you want to print</p>
    <div class="ip-badge">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
      Server: <span id="ipText">${ip}:${PORT}</span>
    </div>
    <div class="ip-change" id="ipChange">IP changed! New address detected.</div>
  </div>
  <div class="qr-wrap">
    <img id="qrImg" width="180" height="180" alt="QR Code">
    <div class="qr-label">Scan to open on your phone</div>
  </div>
  <div class="cards">
    <a href="/client/print" class="card-link">
      <div class="choice-card">
        <div class="choice-icon print">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="1.5"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        </div>
        <h2>Print Now</h2>
        <p>Upload a document and send it directly to the printer immediately</p>
      </div>
    </a>
    <a href="/client/schedule" class="card-link">
      <div class="choice-card">
        <div class="choice-icon schedule">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
        </div>
        <h2>Schedule Print</h2>
        <p>Upload a document and pick a time to print it later</p>
      </div>
    </a>
  </div>
  <div class="footer-links">
    <a href="/client/uploads">Recent Uploads</a>
  </div>
</div>
<script>
var lastIP='${ip}:${PORT}';
function checkIP(){
  fetch('/api/ip').then(function(r){return r.json()}).then(function(d){
    var current=d.ip+':'+d.port;
    document.getElementById('ipText').textContent=current;
    if(lastIP&&lastIP!==current){
      document.getElementById('ipChange').style.display='block';
      document.title='Print Hub ('+current+')';
    }
    lastIP=current;
    fetchQR();
  }).catch(function(){});
}
function fetchQR(){
  fetch('/api/qr-code').then(function(r){return r.json()}).then(function(d){
    if(d.qr)document.getElementById('qrImg').src=d.qr;
  }).catch(function(){});
}
fetchQR();
setInterval(checkIP,5000);
</script>
</body>
</html>`);
  });

  // ===== CLIENT PRINT PAGE (upload & print immediately) =====
  app.get('/client/print', (req, res) => {
    const printers = queryAll("SELECT id, name FROM printers WHERE enabled = 1 ORDER BY is_default DESC");
    const ip = getLocalIP();

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Print Hub - Print Now</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0f172a;color:#f1f5f9;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.container{max-width:480px;width:100%}
.header{display:flex;align-items:center;gap:12px;margin-bottom:28px}
.back{width:36px;height:36px;border-radius:10px;background:#1e293b;border:1px solid #334155;display:flex;align-items:center;justify-content:center;text-decoration:none;color:#f1f5f9;flex-shrink:0}
.back:hover{border-color:#6366f1}
.header-text h1{font-size:22px;font-weight:700;color:#f1f5f9}
.header-text p{font-size:12px;color:#94a3b8}
.upload-zone{background:#1e293b;border:2px dashed #334155;border-radius:16px;padding:36px 20px;text-align:center;cursor:pointer;transition:all .3s;margin-bottom:16px}
.upload-zone:hover,.upload-zone.dragover{border-color:#6366f1;background:rgba(99,102,241,.1)}
.upload-zone svg{width:44px;height:44px;color:#64748b;margin-bottom:10px}
.upload-zone h3{font-size:15px;margin-bottom:4px}
.upload-zone p{font-size:12px;color:#64748b}
.file-info{background:#1e293b;border-radius:12px;padding:14px;margin-bottom:14px;display:none}
.file-info.show{display:flex;align-items:center;gap:10px}
.file-icon{width:40px;height:40px;background:rgba(239,68,68,.15);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#ef4444;flex-shrink:0}
.file-details{flex:1;min-width:0}
.file-name{font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.file-size{font-size:11px;color:#94a3b8}
.file-remove{background:none;border:none;color:#ef4444;cursor:pointer;padding:4px}
.form-group{margin-bottom:12px}
.form-group label{display:block;font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:5px}
.form-group input,.form-group select{width:100%;padding:10px 14px;background:#0f172a;border:1px solid #334155;border-radius:10px;color:#f1f5f9;font-size:14px;outline:none}
.form-group input:focus,.form-group select:focus{border-color:#6366f1}
.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.upload-btn{width:100%;padding:14px;background:linear-gradient(135deg,#6366f1,#818cf8);border:none;border-radius:12px;color:white;font-size:16px;font-weight:700;cursor:pointer;transition:all .3s;margin-top:6px}
.upload-btn:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(99,102,241,.3)}
.upload-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
.progress{display:none;margin-top:10px}.progress.show{display:block}
.progress-bar{height:6px;background:#1e293b;border-radius:3px;overflow:hidden}
.progress-fill{height:100%;background:linear-gradient(90deg,#6366f1,#a855f7);border-radius:3px;transition:width .3s;width:0}
.progress-text{font-size:11px;color:#94a3b8;text-align:center;margin-top:5px}
.success{text-align:center;padding:40px 20px;display:none}.success.show{display:block}
.success svg{width:56px;height:56px;color:#22c55e;margin-bottom:14px}
.success h2{font-size:20px;margin-bottom:6px}
.success p{color:#94a3b8;font-size:13px}
.btn-row{display:flex;gap:8px;margin-top:16px;justify-content:center}
.btn-outline{padding:10px 20px;background:#1e293b;border:1px solid #334155;border-radius:10px;color:#f1f5f9;cursor:pointer;font-size:13px;font-weight:500;text-decoration:none}
.btn-outline:hover{border-color:#6366f1}
.error-msg{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);border-radius:10px;padding:10px;color:#ef4444;font-size:12px;margin-top:10px;display:none}
.error-msg.show{display:block}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <a href="/client" class="back"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,18 9,12 15,6"/></svg></a>
    <div class="header-text"><h1>Print Now</h1><p>Upload and print immediately &bull; ${ip}:${PORT}</p></div>
  </div>
  <div id="uploadForm">
    <div class="upload-zone" id="dropZone" onclick="document.getElementById('fileInput').click()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <h3>Tap to select file</h3>
      <p>PDF, DOC, DOCX, JPG, PNG, GIF, BMP, TXT</p>
    </div>
    <input type="file" id="fileInput" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.tif,.txt,.webp,.heic" style="display:none">
    <div class="file-info" id="fileInfo">
      <div class="file-icon" id="fileIcon">PDF</div>
      <div class="file-details"><div class="file-name" id="fileName"></div><div class="file-size" id="fileSize"></div></div>
      <button class="file-remove" onclick="removeFile()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="form-group"><label>Your Name</label><input type="text" id="userName" placeholder="Enter your name" value="Guest"></div>
    <div class="row">
      <div class="form-group"><label>Printer</label><select id="printerId">${printers.map(p => '<option value="'+p.id+'">'+p.name+'</option>').join('')}</select></div>
      <div class="form-group"><label>Copies</label><select id="copies"><option>1</option><option>2</option><option>3</option><option>5</option><option>10</option></select></div>
    </div>
    <div class="row">
      <div class="form-group"><label>Color</label><select id="colorMode"><option value="bw">B&W</option><option value="color">Color</option></select></div>
      <div class="form-group"><label>Paper</label><select id="paperSize"><option>A4</option><option>Letter</option><option>Legal</option></select></div>
    </div>
    <button class="upload-btn" id="uploadBtn" disabled onclick="uploadFile()">Upload & Print</button>
    <div class="progress" id="progress"><div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div><div class="progress-text" id="progressText">Uploading...</div></div>
    <div class="error-msg" id="errorMsg"></div>
  </div>
<div class="success" id="successView">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
    <h2>Document Sent Successfully</h2>
    <div class="token-display" id="tokenDisplay" style="margin: 16px 0; padding: 16px; background: rgba(99,102,241,.15); border: 1px solid rgba(99,102,241,.3); border-radius: 12px; text-align: center;">
      <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px; font-weight: 600;">YOUR DOCUMENT TOKEN</div>
      <div id="tokenValue" style="font-size: 36px; font-weight: 800; color: #6366f1; letter-spacing: 8px; font-family: monospace;">#0000</div>
      <button onclick="copyToken()" class="btn-outline" style="margin-top: 12px; padding: 8px 16px; font-size: 12px;">COPY TOKEN</button>
    </div>
    <div style="font-size: 13px; color: #94a3b8; line-height: 1.8;">
      <div><strong>Document:</strong> <span id="successFileName">-</span></div>
      <div><strong>Print Station:</strong> STATION-ALPHA</div>
      <div><strong>Status:</strong> <span id="successStatus" style="color: #f59e0b;">QUEUED</span></div>
    </div>
    <div class="btn-row">
      <a href="/client/print" class="btn-outline">Print Another</a>
      <a href="/client/uploads" class="btn-outline">View Uploads</a>
    </div>
  </div>
</div>
<script>
let selectedFile=null, lastToken=null;
const drop=document.getElementById('dropZone'),fi=document.getElementById('fileInput');
drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('dragover')});
drop.addEventListener('dragleave',()=>drop.classList.remove('dragover'));
drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('dragover');if(e.dataTransfer.files.length)selectFile(e.dataTransfer.files[0])});
fi.addEventListener('change',e=>{if(e.target.files.length)selectFile(e.target.files[0])});
function selectFile(f){selectedFile=f;const ext=f.name.split('.').pop().toUpperCase();document.getElementById('fileIcon').textContent=ext;document.getElementById('fileName').textContent=f.name;document.getElementById('fileSize').textContent=(f.size/1024).toFixed(1)+' KB';document.getElementById('fileInfo').classList.add('show');document.getElementById('uploadBtn').disabled=false}
function removeFile(){selectedFile=null;fi.value='';document.getElementById('fileInfo').classList.remove('show');document.getElementById('uploadBtn').disabled=true}
let uploadRetries=0;
async function uploadFile(){
  if(!selectedFile)return;
  const btn=document.getElementById('uploadBtn');btn.disabled=true;btn.textContent='Uploading...';
  document.getElementById('progress').classList.add('show');
  document.getElementById('errorMsg').classList.remove('show');
  const fd=new FormData();fd.append('file',selectedFile);fd.append('user_name',document.getElementById('userName').value||'Guest');fd.append('device_name',navigator.userAgent);fd.append('printer_id',document.getElementById('printerId').value);fd.append('copies',document.getElementById('copies').value);fd.append('color_mode',document.getElementById('colorMode').value);fd.append('paper_size',document.getElementById('paperSize').value);
  function doUpload(retryCount){
    const xhr=new XMLHttpRequest();
    xhr.timeout=120000;
    xhr.upload.onprogress=e=>{if(e.lengthComputable){const pct=Math.round(e.loaded/e.total*100);document.getElementById('progressFill').style.width=pct+'%';document.getElementById('progressText').textContent='Uploading... '+pct+'%'}};
    xhr.onload=()=>{uploadRetries=0;if(xhr.status===200){var r=JSON.parse(xhr.responseText);lastToken=r.documentToken;document.getElementById('tokenValue').textContent='#'+lastToken;document.getElementById('successFileName').textContent=r.fileName || selectedFile.name;document.getElementById('successStatus').textContent='QUEUED';document.getElementById('uploadForm').style.display='none';document.getElementById('successView').classList.add('show')}else{var msg='Upload failed';try{var r=JSON.parse(xhr.responseText);msg=r.error||msg}catch(e){msg+=': '+xhr.responseText}document.getElementById('errorMsg').textContent=msg;document.getElementById('errorMsg').classList.add('show');btn.disabled=false;btn.textContent='Upload & Print';document.getElementById('progress').classList.remove('show')}};
    xhr.ontimeout=()=>{if(retryCount<2){document.getElementById('progressText').textContent='Retrying... '+(retryCount+1)+'/3';setTimeout(()=>doUpload(retryCount+1),2000)}else{document.getElementById('errorMsg').textContent='Connection timed out. Check your network and try again.';document.getElementById('errorMsg').classList.add('show');btn.disabled=false;btn.textContent='Upload & Print';document.getElementById('progress').classList.remove('show')}};
    xhr.onerror=()=>{if(retryCount<2){document.getElementById('progressText').textContent='Retrying... '+(retryCount+1)+'/3';setTimeout(()=>doUpload(retryCount+1),2000)}else{document.getElementById('errorMsg').textContent='Cannot connect to server. Make sure you are connected to the Print Hub WiFi.';document.getElementById('errorMsg').classList.add('show');btn.disabled=false;btn.textContent='Upload & Print';document.getElementById('progress').classList.remove('show')}};
    xhr.open('POST','/api/upload');xhr.send(fd);
  }
  doUpload(0);
}
function copyToken(){
  if(lastToken){navigator.clipboard.writeText(lastToken);const btn=document.querySelector('.token-display button');const orig=btn.textContent;btn.textContent='COPIED!';setTimeout(()=>btn.textContent=orig,1500);}}
</script>
</body>
</html>`);
  });

  // ===== CLIENT SCHEDULE PAGE =====
  app.get('/client/schedule', (req, res) => {
    const printers = queryAll("SELECT id, name FROM printers WHERE enabled = 1 ORDER BY is_default DESC");
    const ip = getLocalIP();

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Print Hub - Schedule Print</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0f172a;color:#f1f5f9;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.container{max-width:480px;width:100%}
.header{display:flex;align-items:center;gap:12px;margin-bottom:28px}
.back{width:36px;height:36px;border-radius:10px;background:#1e293b;border:1px solid #334155;display:flex;align-items:center;justify-content:center;text-decoration:none;color:#f1f5f9;flex-shrink:0}
.back:hover{border-color:#6366f1}
.header-text h1{font-size:22px;font-weight:700;color:#f1f5f9}
.header-text p{font-size:12px;color:#94a3b8}
.upload-zone{background:#1e293b;border:2px dashed #334155;border-radius:16px;padding:36px 20px;text-align:center;cursor:pointer;transition:all .3s;margin-bottom:16px}
.upload-zone:hover,.upload-zone.dragover{border-color:#a855f7;background:rgba(168,85,247,.1)}
.upload-zone svg{width:44px;height:44px;color:#64748b;margin-bottom:10px}
.upload-zone h3{font-size:15px;margin-bottom:4px}
.upload-zone p{font-size:12px;color:#64748b}
.file-info{background:#1e293b;border-radius:12px;padding:14px;margin-bottom:14px;display:none}
.file-info.show{display:flex;align-items:center;gap:10px}
.file-icon{width:40px;height:40px;background:rgba(168,85,247,.15);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#a855f7;flex-shrink:0}
.file-details{flex:1;min-width:0}
.file-name{font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.file-size{font-size:11px;color:#94a3b8}
.file-remove{background:none;border:none;color:#ef4444;cursor:pointer;padding:4px}
.form-group{margin-bottom:12px}
.form-group label{display:block;font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:5px}
.form-group input,.form-group select{width:100%;padding:10px 14px;background:#0f172a;border:1px solid #334155;border-radius:10px;color:#f1f5f9;font-size:14px;outline:none}
.form-group input:focus,.form-group select:focus{border-color:#a855f7}
.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.schedule-btn{width:100%;padding:14px;background:linear-gradient(135deg,#a855f7,#c084fc);border:none;border-radius:12px;color:white;font-size:16px;font-weight:700;cursor:pointer;transition:all .3s;margin-top:6px}
.schedule-btn:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(168,85,247,.3)}
.schedule-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
.progress{display:none;margin-top:10px}.progress.show{display:block}
.progress-bar{height:6px;background:#1e293b;border-radius:3px;overflow:hidden}
.progress-fill{height:100%;background:linear-gradient(90deg,#a855f7,#c084fc);border-radius:3px;transition:width .3s;width:0}
.progress-text{font-size:11px;color:#94a3b8;text-align:center;margin-top:5px}
.success{text-align:center;padding:40px 20px;display:none}.success.show{display:block}
.success svg{width:56px;height:56px;color:#22c55e;margin-bottom:14px}
.success h2{font-size:20px;margin-bottom:6px}
.success p{color:#94a3b8;font-size:13px}
.btn-row{display:flex;gap:8px;margin-top:16px;justify-content:center}
.btn-outline{padding:10px 20px;background:#1e293b;border:1px solid #334155;border-radius:10px;color:#f1f5f9;cursor:pointer;font-size:13px;font-weight:500;text-decoration:none}
.btn-outline:hover{border-color:#a855f7}
.error-msg{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);border-radius:10px;padding:10px;color:#ef4444;font-size:12px;margin-top:10px;display:none}
.error-msg.show{display:block}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <a href="/client" class="back"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,18 9,12 15,6"/></svg></a>
    <div class="header-text"><h1>Schedule Print</h1><p>Upload and pick a time to print later &bull; ${ip}:${PORT}</p></div>
  </div>
  <div id="uploadForm">
    <div class="upload-zone" id="dropZone" onclick="document.getElementById('fileInput').click()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <h3>Tap to select file</h3>
      <p>PDF, DOC, DOCX, JPG, PNG, GIF, BMP, TXT</p>
    </div>
    <input type="file" id="fileInput" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.tif,.txt,.webp,.heic" style="display:none">
    <div class="file-info" id="fileInfo">
      <div class="file-icon" id="fileIcon">PDF</div>
      <div class="file-details"><div class="file-name" id="fileName"></div><div class="file-size" id="fileSize"></div></div>
      <button class="file-remove" onclick="removeFile()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="form-group"><label>Your Name</label><input type="text" id="userName" placeholder="Enter your name" value="Guest"></div>
    <div class="form-group"><label>Job Name</label><input type="text" id="jobName" placeholder="Optional label for this print"></div>
    <div class="form-group"><label>Schedule Date & Time</label><input type="datetime-local" id="scheduledTime"></div>
    <div class="row">
      <div class="form-group"><label>Printer</label><select id="printerId">${printers.map(p => '<option value="'+p.id+'">'+p.name+'</option>').join('')}</select></div>
      <div class="form-group"><label>Copies</label><select id="copies"><option>1</option><option>2</option><option>3</option><option>5</option><option>10</option></select></div>
    </div>
    <div class="row">
      <div class="form-group"><label>Color</label><select id="colorMode"><option value="bw">B&W</option><option value="color">Color</option></select></div>
      <div class="form-group"><label>Paper</label><select id="paperSize"><option>A4</option><option>Letter</option><option>Legal</option></select></div>
    </div>
    <div class="form-group"><label>Notes (optional)</label><input type="text" id="notes" placeholder="Any special instructions"></div>
    <button class="schedule-btn" id="scheduleBtn" disabled onclick="scheduleJob()">Schedule Print</button>
    <div class="progress" id="progress"><div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div><div class="progress-text" id="progressText">Uploading...</div></div>
    <div class="error-msg" id="errorMsg"></div>
  </div>
  <div class="success" id="successView">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
    <h2>Scheduled!</h2>
    <p>Your print job has been scheduled.</p>
    <div class="btn-row">
      <a href="/client/schedule" class="btn-outline">Schedule Another</a>
      <a href="/client" class="btn-outline">Home</a>
    </div>
  </div>
</div>
<script>
let selectedFile=null;
const drop=document.getElementById('dropZone'),fi=document.getElementById('fileInput');
drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('dragover')});
drop.addEventListener('dragleave',()=>drop.classList.remove('dragover'));
drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('dragover');if(e.dataTransfer.files.length)selectFile(e.dataTransfer.files[0])});
fi.addEventListener('change',e=>{if(e.target.files.length)selectFile(e.target.files[0])});
function selectFile(f){selectedFile=f;const ext=f.name.split('.').pop().toUpperCase();document.getElementById('fileIcon').textContent=ext;document.getElementById('fileName').textContent=f.name;document.getElementById('fileSize').textContent=(f.size/1024).toFixed(1)+' KB';document.getElementById('fileInfo').classList.add('show');document.getElementById('scheduleBtn').disabled=false}
function removeFile(){selectedFile=null;fi.value='';document.getElementById('fileInfo').classList.remove('show');document.getElementById('scheduleBtn').disabled=true}
async function scheduleJob(){
  if(!selectedFile)return;
  const btn=document.getElementById('scheduleBtn');btn.disabled=true;btn.textContent='Uploading...';
  document.getElementById('progress').classList.add('show');
  document.getElementById('errorMsg').classList.remove('show');
  const fd=new FormData();fd.append('file',selectedFile);fd.append('user_name',document.getElementById('userName').value||'Guest');fd.append('job_name',document.getElementById('jobName').value||selectedFile.name);fd.append('scheduled_time',document.getElementById('scheduledTime').value);fd.append('printer_id',document.getElementById('printerId').value);fd.append('copies',document.getElementById('copies').value);fd.append('color_mode',document.getElementById('colorMode').value);fd.append('paper_size',document.getElementById('paperSize').value);fd.append('notes',document.getElementById('notes').value);
  function doUpload(retryCount){
    const xhr=new XMLHttpRequest();
    xhr.timeout=120000;
    xhr.upload.onprogress=e=>{if(e.lengthComputable){const pct=Math.round(e.loaded/e.total*100);document.getElementById('progressFill').style.width=pct+'%';document.getElementById('progressText').textContent='Uploading... '+pct+'%'}};
    xhr.onload=()=>{if(xhr.status===200){document.getElementById('uploadForm').style.display='none';document.getElementById('successView').classList.add('show')}else{var msg='Upload failed';try{var r=JSON.parse(xhr.responseText);msg=r.error||msg}catch(e){msg+=': '+xhr.responseText}document.getElementById('errorMsg').textContent=msg;document.getElementById('errorMsg').classList.add('show');btn.disabled=false;btn.textContent='Schedule Print';document.getElementById('progress').classList.remove('show')}};
    xhr.ontimeout=()=>{if(retryCount<2){document.getElementById('progressText').textContent='Retrying... ('+(retryCount+1)+'/3)';setTimeout(()=>doUpload(retryCount+1),2000)}else{document.getElementById('errorMsg').textContent='Connection timed out. Check your network and try again.';document.getElementById('errorMsg').classList.add('show');btn.disabled=false;btn.textContent='Schedule Print';document.getElementById('progress').classList.remove('show')}};
    xhr.onerror=()=>{if(retryCount<2){document.getElementById('progressText').textContent='Retrying... ('+(retryCount+1)+'/3)';setTimeout(()=>doUpload(retryCount+1),2000)}else{document.getElementById('errorMsg').textContent='Cannot connect to server. Make sure you are connected to the Print Hub WiFi.';document.getElementById('errorMsg').classList.add('show');btn.disabled=false;btn.textContent='Schedule Print';document.getElementById('progress').classList.remove('show')}};
    xhr.open('POST','/api/client/schedule');xhr.send(fd);
  }
  doUpload(0);
}
</script>
</body>
</html>`);
  });

  // ===== CLIENT UPLOADS VIEW PAGE =====
  app.get('/client/uploads', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Print Hub - Recent Uploads</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0f172a;color:#f1f5f9;min-height:100vh;padding:20px}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;max-width:600px;margin-left:auto;margin-right:auto}
.logo h1{font-size:22px;font-weight:800;background:linear-gradient(135deg,#6366f1,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.logo p{font-size:12px;color:#94a3b8}
.nav-link{padding:8px 16px;background:#1e293b;border:1px solid #334155;border-radius:8px;color:#f1f5f9;text-decoration:none;font-size:13px;font-weight:500;transition:all .2s}
.nav-link:hover{border-color:#6366f1;background:rgba(99,102,241,.1)}
.container{max-width:600px;margin:0 auto}
.search-box{position:relative;margin-bottom:16px}
.search-box input{width:100%;padding:12px 16px 12px 40px;background:#1e293b;border:1px solid #334155;border-radius:10px;color:#f1f5f9;font-size:14px;outline:none;transition:border-color .2s}
.search-box input:focus{border-color:#6366f1}
.search-box input::placeholder{color:#64748b}
.search-box svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#64748b}
.search-box .clear-btn{position:absolute;right:8px;top:50%;transform:translateY(-50%);padding:4px 10px;background:transparent;border:1px solid #334155;border-radius:6px;color:#94a3b8;font-size:11px;cursor:pointer;display:none}
.search-box .clear-btn.show{display:block}
.filters{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.filter-btn{padding:6px 14px;border-radius:20px;border:1px solid #334155;background:transparent;color:#94a3b8;font-size:12px;font-weight:500;cursor:pointer;transition:all .2s}
.filter-btn.active{background:rgba(99,102,241,.15);border-color:#6366f1;color:#a5b4fc}
.filter-btn:hover{border-color:#6366f1}
.job-card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px;margin-bottom:10px;transition:all .2s}
.job-card:hover{border-color:#475569}
.job-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}
.job-name{font-weight:600;font-size:14px;color:#f1f5f9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:300px}
.job-meta{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px}
.job-meta span{font-size:11px;color:#94a3b8;display:flex;align-items:center;gap:4px}
.token-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);border-radius:6px;font-family:monospace;font-size:12px;font-weight:700;color:#a5b4fc;margin-right:8px}
.badge{padding:3px 8px;border-radius:6px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
.badge-waiting{background:rgba(251,191,36,.15);color:#fbbf24}
.badge-printing{background:rgba(168,85,247,.15);color:#a855f7}
.badge-completed{background:rgba(34,197,94,.15);color:#22c55e}
.badge-error{background:rgba(239,68,68,.15);color:#ef4444}
.badge-info{background:rgba(99,102,241,.15);color:#818cf8}
.job-actions{display:flex;gap:8px;margin-top:10px}
.btn{padding:8px 16px;border-radius:8px;font-size:12px;font-weight:600;border:none;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
.btn-primary{background:linear-gradient(135deg,#6366f1,#818cf8);color:white}
.btn-primary:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(99,102,241,.3)}
.btn-secondary{background:#0f172a;border:1px solid #334155;color:#f1f5f9}
.btn-secondary:hover{border-color:#6366f1}
.empty{text-align:center;padding:60px 20px;color:#64748b}
.empty svg{margin-bottom:16px}
.empty h3{font-size:16px;margin-bottom:4px;color:#94a3b8}
.empty p{font-size:13px}
.loading{text-align:center;padding:40px;color:#64748b;font-size:14px}
.refresh-bar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.refresh-bar span{font-size:12px;color:#64748b}
.auto-dot{width:8px;height:8px;border-radius:50%;background:#22c55e;display:inline-block;margin-right:6px;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
</style>
</head>
<body>
<div class="header">
  <div class="logo"><h1>Recent Uploads</h1><p>Files uploaded from mobile devices</p></div>
  <a href="/client" class="nav-link">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    Upload New
  </a>
</div>
<div class="container">
  <div class="refresh-bar">
    <span><span class="auto-dot"></span>Auto-refreshes every 5s</span>
    <button class="btn btn-secondary" onclick="loadJobs()">Refresh Now</button>
  </div>
  <div class="search-box">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <input type="text" id="searchInput" placeholder="Search by document name or 4-digit token..." oninput="doSearch()">
    <button class="clear-btn" id="clearBtn" onclick="clearSearch()">Clear</button>
  </div>
  <div class="filters">
    <button class="filter-btn active" data-filter="all" onclick="setFilter('all',this)">All</button>
    <button class="filter-btn" data-filter="active" onclick="setFilter('active',this)">Active</button>
    <button class="filter-btn" data-filter="completed" onclick="setFilter('completed',this)">Completed</button>
    <button class="filter-btn" data-filter="error" onclick="setFilter('error',this)">Failed</button>
  </div>
  <div id="jobsList"><div class="loading">Loading uploads...</div></div>
</div>
<script>
let allJobs=[];let currentFilter='all';let currentSearch='';
function setFilter(f,el){currentFilter=f;document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));el.classList.add('active');renderJobs()}
function doSearch(){currentSearch=document.getElementById('searchInput').value.toLowerCase();document.getElementById('clearBtn').className='clear-btn'+(currentSearch?' show':'');renderJobs()}
function clearSearch(){document.getElementById('searchInput').value='';currentSearch='';document.getElementById('clearBtn').className='clear-btn';renderJobs()}
function renderJobs(){
  let jobs=allJobs;
  if(currentFilter==='active')jobs=jobs.filter(j=>['uploading','processing','waiting','printing'].includes(j.status));
  else if(currentFilter==='completed')jobs=jobs.filter(j=>j.status==='completed');
  else if(currentFilter==='error')jobs=jobs.filter(j=>j.status==='error'||j.status==='cancelled');
  if(currentSearch)jobs=jobs.filter(j=>(j.original_name&&j.original_name.toLowerCase().includes(currentSearch))||(j.document_token&&j.document_token.includes(currentSearch)));
  const el=document.getElementById('jobsList');
  if(!jobs.length){el.innerHTML='<div class="empty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14,2 L6,2 C4.9,2 4,2.9 4,4 L4,20 C4,21.1 4.9,22 6,22 L18,22 C19.1,22 20,21.1 20,20 L20,8 Z"/><polyline points="14,2 14,8 20,8"/></svg><h3>No uploads found</h3><p>'+(currentSearch?'No matching documents found for "'+currentSearch+'"':'Files uploaded from mobile will appear here')+'</p></div>';return}
  el.innerHTML=jobs.map(j=>{
    const statusMap={uploading:'info',processing:'info',waiting:'waiting',printing:'printing',completed:'completed',error:'error',cancelled:'error'};
    const badgeClass='badge-'+(statusMap[j.status]||'info');
    const size=j.file_size<1024*1024?(j.file_size/1024).toFixed(1)+' KB':(j.file_size/(1024*1024)).toFixed(1)+' MB';
    const time=j.upload_time?new Date(j.upload_time).toLocaleString():'-';
    return '<div class="job-card">'+
      '<div class="job-top"><div class="job-name"><span class="token-badge">#'+(j.document_token||'----')+'</span>'+j.original_name+'</div><span class="badge '+badgeClass+'">'+j.status+'</span></div>'+
      '<div class="job-meta">'+
        '<span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> '+j.user_name+'</span>'+
        '<span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg> '+size+'</span>'+
        '<span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg> '+j.total_pages+' pages</span>'+
        '<span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg> '+time+'</span>'+
      '</div>'+
      '<div class="job-actions">'+
        '<button class="btn btn-primary" onclick="window.open(\'/print/'+j.id+'\',\'_blank\')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Print</button>'+
        '<a href="/api/jobs/'+j.id+'/file" download class="btn btn-secondary"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download</a>'+
      '</div>'+
    '</div>';
  }).join('');
}
async function loadJobs(){
  try{const r=await fetch('/api/client-uploads');allJobs=await r.json();renderJobs()}catch(e){document.getElementById('jobsList').innerHTML='<div class="empty"><h3>Failed to load</h3><p>'+e.message+'</p></div>'}
}
loadJobs();setInterval(loadJobs,5000);
</script>
</body>
</html>`);
  });

  // ===== MOBILE TOKEN TRACKING PAGE =====
  app.get('/client/track', (req, res) => {
    const ip = getLocalIP();
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Print Hub - Track Document</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0f172a;color:#f1f5f9;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.container{max-width:480px;width:100%}
.header{display:flex;align-items:center;gap:12px;margin-bottom:28px}
.back{width:36px;height:36px;border-radius:10px;background:#1e293b;border:1px solid #334155;display:flex;align-items:center;justify-content:center;text-decoration:none;color:#f1f5f9;flex-shrink:0}
.back:hover{border-color:#6366f1}
.header-text h1{font-size:22px;font-weight:700;color:#f1f5f9}
.header-text p{font-size:12px;color:#94a3b8}
.track-form{background:#1e293b;border:2px dashed #334155;border-radius:16px;padding:36px 20px;text-align:center;margin-bottom:16px}
.track-form h3{font-size:15px;margin-bottom:4px}
.track-form p{font-size:12px;color:#64748b;margin-bottom:20px}
.token-inputs{display:flex;gap:8px;justify-content:center;margin-bottom:20px}
.token-input{width:56px;height:56px;border-radius:12px;background:#0f172a;border:2px solid #334155;color:#f1f5f9;font-size:24px;font-weight:700;text-align:center;outline:none;transition:all .3s}
.token-input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.2)}
.token-input.filled{background:rgba(99,102,241,.1);border-color:#6366f1}
.track-btn{width:100%;padding:14px;background:linear-gradient(135deg,#6366f1,#818cf8);border:none;border-radius:12px;color:white;font-size:16px;font-weight:700;cursor:pointer;transition:all .3s}
.track-btn:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(99,102,241,.3)}
.track-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
.result{display:none;margin-top:24px}
.result.show{display:block}
.result-header{text-align:center;padding:20px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.2);border-radius:12px;margin-bottom:16px}
.result-header.error{background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.2)}
.token-display{font-size:48px;font-weight:800;color:#22c55e;letter-spacing:8px;margin-bottom:4px}
.token-display.error{color:#ef4444}
.result-title{font-size:14px;color:#94a3b8}
.result-body{background:#1e293b;border-radius:12px;padding:16px}
.result-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #334155}
.result-row:last-child{border:none}
.result-label{font-size:12px;color:#94a3b8}
.result-value{font-size:13px;font-weight:500;color:#f1f5f9}
.status-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600}
.status-queued{background:rgba(59,130,246,.2);color:#60a5fa}
.status-waiting{background:rgba(245,158,11,.2);color:#fbbf24}
.status-printing{background:rgba(168,85,247,.2);color:#c084fc}
.status-completed{background:rgba(34,197,94,.2);color:#4ade80}
.status-error, .status-cancelled, .status-failed{background:rgba(239,68,68,.2);color:#f87171}
.progress-steps{display:flex;flex-direction:column;gap:12px;margin-top:20px}
.step{display:flex;align-items:center;gap:12px;padding:12px;background:#1e293b;border-radius:10px}
.step-icon{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.step-icon.done{background:#22c55e}
.step-icon.current{background:#6366f1;animation:pulse 2s infinite}
.step-icon.pending{background:#334155}
.step-text{font-size:13px;color:#f1f5f9}
.step-text.pending{color:#64748b}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
.error-msg{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);border-radius:10px;padding:10px;color:#ef4444;font-size:12px;margin-top:10px;display:none}
.error-msg.show{display:block}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <a href="/client" class="back"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,18 9,12 15,6"/></svg></a>
    <div class="header-text"><h1>Track Document</h1><p>Enter your 4-digit token to check status</p></div>
  </div>
  <div class="track-form" id="trackForm">
    <h3>Track Your Document</h3>
    <p>Enter the 4-digit document token you received after upload</p>
    <div class="token-inputs">
      <input type="text" class="token-input" maxlength="1" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
      <input type="text" class="token-input" maxlength="1" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
      <input type="text" class="token-input" maxlength="1" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
      <input type="text" class="token-input" maxlength="1" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
    </div>
    <button class="track-btn" id="trackBtn" disabled onclick="trackDocument()">TRACK</button>
    <div class="error-msg" id="errorMsg"></div>
  </div>
  <div class="result" id="result">
    <div class="result-header" id="resultHeader">
      <div class="token-display" id="tokenDisplay"></div>
      <div class="result-title" id="resultTitle"></div>
    </div>
    <div class="result-body" id="resultBody"></div>
    <div class="progress-steps" id="progressSteps"></div>
  </div>
</div>
<script>
const inputs=document.querySelectorAll('.token-input');
inputs.forEach((input,i)=>{
  input.addEventListener('input',e=>{
    input.value=input.value.replace(/[^0-9]/g,'');
    if(input.value)input.classList.add('filled');
    else input.classList.remove('filled');
    if(input.value&&i<inputs.length-1)inputs[i+1].focus();
    checkAllFilled();
  });
  input.addEventListener('keydown',e=>{
    if(e.key==='Backspace'&&!input.value&&i>0)inputs[i-1].focus();
  });
});
function checkAllFilled(){
  const allFilled=Array.from(inputs).every(i=>i.value);
  document.getElementById('trackBtn').disabled=!allFilled;
}
async function trackDocument(){
  const token=Array.from(inputs).map(i=>i.value).join('');
  if(token.length!==4)return;
  const btn=document.getElementById('trackBtn');
  btn.disabled=true;btn.textContent='TRACKING...';
  document.getElementById('errorMsg').classList.remove('show');
  document.getElementById('result').classList.remove('show');
  try{
    const res=await fetch('/api/track/'+token);
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||'Failed to track');
    showResult(data);
  }catch(e){
    document.getElementById('errorMsg').textContent=e.message;
    document.getElementById('errorMsg').classList.add('show');
  }
  btn.disabled=false;btn.textContent='TRACK';
}
function showResult(data){
  document.getElementById('result').classList.add('show');
  document.getElementById('tokenDisplay').textContent='#'+data.documentToken;
  document.getElementById('tokenDisplay').classList.remove('error');
  document.getElementById('resultHeader').classList.remove('error');
  document.getElementById('resultTitle').textContent='Document Found';
  const statusMap={
    uploading:{label:'Uploaded',class:'status-queued'},
    processing:{label:'Processing',class:'status-queued'},
    waiting:{label:'Waiting for Print',class:'status-waiting'},
    printing:{label:'Printing',class:'status-printing'},
    completed:{label:'Completed',class:'status-completed'},
    error:{label:'Failed',class:'status-error'},
    cancelled:{label:'Cancelled',class:'status-cancelled'},
    failed:{label:'Failed',class:'status-failed'}
  };
  const s=statusMap[data.status]||{label:data.status,class:'status-queued'};
  let html='';
  html+='<div class="result-row"><span class="result-label">File Name</span><span class="result-value">'+data.fileName+'</span></div>';
  html+='<div class="result-row"><span class="result-label">User</span><span class="result-value">'+data.userName+'</span></div>';
  html+='<div class="result-row"><span class="result-label">Print Station</span><span class="result-value">'+data.deviceName+'</span></div>';
  html+='<div class="result-row"><span class="result-label">Status</span><span class="result-value"><span class="status-badge '+s.class+'">'+s.label+'</span></span></div>';
  html+='<div class="result-row"><span class="result-label">Uploaded</span><span class="result-value">'+(data.uploadTime?new Date(data.uploadTime).toLocaleString():'-')+'</span></div>';
  html+='<div class="result-row"><span class="result-label">Pages</span><span class="result-value">'+data.totalPages+'</span></div>';
  html+='<div class="result-row"><span class="result-label">Copies</span><span class="result-value">'+data.copies+'</span></div>';
  html+='<div class="result-row"><span class="result-label">Color</span><span class="result-value">'+(data.colorMode==='color'?'Color':'B&W')+'</span></div>';
  html+='<div class="result-row"><span class="result-label">Paper</span><span class="result-value">'+data.paperSize+'</span></div>';
  document.getElementById('resultBody').innerHTML=html;
  const steps=[
    {key:'uploading',label:'Uploaded'},
    {key:'waiting',label:'Received by Print Station'},
    {key:'printing',label:'Waiting for Print'},
    {key:'completed',label:'Completed'}
  ];
  let currentReached=false;
  let stepsHtml='';
  steps.forEach(step=>{
    const done=['uploading','processing'].includes(data.status)||(data.status===step.key)||(currentReached&&step.key!=='completed');
    const current=!currentReached&&(data.status===step.key||(step.key==='waiting'&&['waiting','printing','completed'].includes(data.status))||(step.key==='printing'&&['printing','completed'].includes(data.status))||(step.key==='completed'&&data.status==='completed'));
    if(current)currentReached=true;
    stepsHtml+='<div class="step">'+
      '<div class="step-icon '+(current?'current':done?'done':'pending')+'">'+
        (current?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><circle cx="12" cy="12" r="10"/></svg>':done?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20,6 9,17 4,12"/></svg>':'')+
      '</div>'+
      '<div class="step-text '+(done||current?'':'pending')+'">'+step.label+(current?' (Current)':'')+'</div>'+
    '</div>';
  });
  document.getElementById('progressSteps').innerHTML=stepsHtml;
}
</script>
</body>
</html>`);
  });

  // Catch-all for admin panel (must be after /client)
  if (fs.existsSync(frontendPath)) {
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads') && !req.path.startsWith('/notes') && !req.path.startsWith('/socket.io') && !req.path.startsWith('/client')) {
        res.sendFile(path.join(frontendPath, 'index.html'));
      }
    });
  }

  } // end routesRegistered guard

  // ===== WEBSOCKET + LISTEN =====

  function attachSocketIO(h) {
    io = new SocketIO(h, { cors: { origin: '*' } });
    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('device-info', (data) => {
        connectedDevices.set(socket.id, data);
        const existing = queryOne('SELECT * FROM devices WHERE ip_address = ?', [data.ip]);
        if (!existing) {
          const devId = uuidv4();
          runSql('INSERT INTO devices (id, name, ip_address, user_agent, status) VALUES (?, ?, ?, ?, ?)', [devId, data.name || 'Unknown', data.ip, data.userAgent || '', 'online']);
          logActivity('device_connected', { device_id: devId, device_name: data.name, ip: data.ip });
        } else {
          runSql("UPDATE devices SET status = 'online', last_activity = CURRENT_TIMESTAMP WHERE id = ?", [existing.id]);
          logActivity('device_connected', { device_id: existing.id, device_name: existing.name, ip: data.ip });
        }
        broadcastStats();
      });

      socket.on('disconnect', () => {
        const devInfo = connectedDevices.get(socket.id);
        if (devInfo) {
          runSql("UPDATE devices SET status = 'offline', last_activity = CURRENT_TIMESTAMP WHERE ip_address = ?", [devInfo.ip]);
          logActivity('device_disconnected', { device_name: devInfo.name, ip: devInfo.ip });
          connectedDevices.delete(socket.id);
          broadcastStats();
        }
      });

      socket.on('start-print', (data) => {
        runSql("UPDATE print_jobs SET status = 'printing', start_time = CURRENT_TIMESTAMP WHERE id = ?", [data.jobId]);
        if (data.printer_id) {
          runSql("UPDATE printers SET status = 'printing', current_user = ?, current_document = ? WHERE id = ?", [data.user_name, data.file_name, data.printer_id]);
        }
        logActivity('print_started', { job_id: data.jobId });
        broadcastStats();
      });

      socket.on('print-progress', (data) => {
        if (io) io.emit('print-progress', data);
      });
    });
   }

  function cleanupFailedAttempt() {
    try { if (io) { io.close(); io = null; } } catch (_) {}
    try { if (server) { server.close(); server = null; } } catch (_) {}
    try { if (httpServer) { httpServer.close(); httpServer = null; } } catch (_) {}
  }

  function isPortAvailable(port, host) {
    return new Promise((resolve) => {
      const tester = http.createServer();
      tester.once('error', (err) => {
        tester.close(() => resolve(false));
      });
      tester.once('listening', () => {
        tester.close(() => resolve(true));
      });
      tester.listen(port, host);
    });
  }

  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const tryPort = PORT + attempt;
    cleanupFailedAttempt();

    const available = await isPortAvailable(tryPort, '0.0.0.0');
    if (!available) {
      if (attempt === maxAttempts - 1) {
        isStarting = false;
        throw Object.assign(new Error(`Port ${tryPort} in use (and all subsequent ports)`), { code: 'EADDRINUSE' });
      }
      log('warn', 'server', `Port ${tryPort} in use, trying ${tryPort + 1}...`);
      continue;
    }

    try {
      await new Promise((resolve, reject) => {
        httpServer = http.createServer(app);
        attachSocketIO(httpServer);

        const onError = (err) => {
          cleanupFailedAttempt();
          reject(err);
        };
        httpServer.once('error', onError);

        server = httpServer.listen(tryPort, '0.0.0.0', () => {
          httpServer.removeListener('error', onError);
          if (tryPort !== PORT) {
            log('info', 'server', `Port ${PORT} in use, using port ${tryPort} instead`);
            PORT = tryPort;
          }
          serverRunning = true;
          isStarting = false;
          log('info', 'server', `Print Hub server started on port ${PORT}`, { ip: getLocalIP(), dataDir: DATA_DIR });
          console.log(`\n  Print Hub Server Running`);
          console.log(`  http://${getLocalIP()}:${PORT}`);
          console.log(`  Data: ${DATA_DIR}\n`);

          try {
            const stationId = 'PRINTHUB-' + getLocalIP().replace(/\./g, '-');
            const network = getNetworkName();
            if (bonjourService) bonjourService.stop();
            bonjourService = bonjour.publish({
              name: 'PrintHub - ' + stationId,
              type: 'printhub',
              port: PORT,
              txt: {
                stationId: stationId,
                ssid: network,
                ip: getLocalIP(),
                version: '1.0.0',
              },
            });
            log('info', 'server', 'Bonjour/mDNS service published', { type: 'printhub', port: PORT, stationId });
          } catch (err) {
            log('warn', 'server', 'Failed to publish Bonjour/mDNS service', { error: err.message });
          }

          broadcastStats();
          resolve();
        });
      });
      return;
    } catch (err) {
      if (err.code !== 'EADDRINUSE' || attempt === maxAttempts - 1) {
        isStarting = false;
        throw err;
      }
      log('warn', 'server', `Port ${tryPort} in use, trying ${tryPort + 1}...`);
    }
  }
}

function stopServer() {
  return new Promise((resolve) => {
    serverRunning = false;
    isStarting = false;
    connectedDevices.clear();

    if (bonjourService) {
      try { bonjourService.stop(); bonjourService = null; } catch (_) {}
    }

    let resolved = false;
    const done = () => {
      if (resolved) return;
      resolved = true;
      server = null;
      httpServer = null;
      io = null;
      log('info', 'server', 'Server stopped');
      resolve();
    };

    if (io) {
      try { io.close(); } catch (_) {}
      io = null;
    }

    if (server) {
      const s = server;
      server = null;
      s.close(() => done());
      setTimeout(() => done(), 2000);
    } else {
      done();
    }
  });
}

function syncPrinters() {
  const detected = detectPrinters();
  for (const p of detected) {
    const existing = queryOne('SELECT id FROM printers WHERE name = ?', [p.name]);
    if (existing) {
      runSql('UPDATE printers SET is_online = ?, status = ?, driver_name = ?, port_name = ? WHERE id = ?', [p.is_online ? 1 : 0, p.status, p.driver_name, p.port_name, existing.id]);
    } else {
      const id = uuidv4();
      const isDefault = detected.indexOf(p) === 0 ? 1 : 0;
      runSql('INSERT INTO printers (id, name, system_name, is_default, is_online, status, driver_name, port_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, p.name, p.system_name, isDefault, p.is_online ? 1 : 0, p.status, p.driver_name, p.port_name]);
    }
  }
}

module.exports = { startServer, stopServer, getPort: () => PORT, isRunning: () => serverRunning };
