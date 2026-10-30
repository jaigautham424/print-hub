const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

function getDataDir() {
  try {
    const { app } = require('electron');
    if (app && app.getPath) {
      return app.getPath('userData');
    }
  } catch (e) {}
  return path.join(__dirname, '../../storage');
}

const DATA_DIR = getDataDir();
const DB_PATH = path.join(DATA_DIR, 'print-hub.db');

function ensureDirs() {
  const dirs = ['uploads', 'notes-library', 'completed-jobs', 'cancelled-jobs', 'logs', 'backups', 'temp'];
  dirs.forEach(d => {
    const dirPath = path.join(DATA_DIR, d);
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  });
}

let db = null;

async function getDb() {
  if (db) return db;
  return await initializeDatabase();
}

async function initializeDatabase() {
  ensureDirs();
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      mac_address TEXT,
      user_agent TEXT,
      connection_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'online',
      current_job_id TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS printers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      system_name TEXT,
      is_default INTEGER DEFAULT 0,
      is_online INTEGER DEFAULT 1,
      status TEXT DEFAULT 'idle',
      current_user TEXT,
      current_document TEXT,
      paper_available INTEGER DEFAULT 100,
      ink_status TEXT DEFAULT 'unknown',
      queue_length INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      driver_name TEXT,
      port_name TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS print_jobs (
      id TEXT PRIMARY KEY,
      queue_number INTEGER DEFAULT 0,
      device_id TEXT,
      printer_id TEXT,
      user_name TEXT NOT NULL,
      device_name TEXT NOT NULL,
      file_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      total_pages INTEGER DEFAULT 1,
      copies INTEGER DEFAULT 1,
      color_mode TEXT DEFAULT 'bw',
      duplex_mode TEXT DEFAULT 'single',
      paper_size TEXT DEFAULT 'A4',
      priority INTEGER DEFAULT 5,
      status TEXT DEFAULT 'uploading',
      upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      start_time DATETIME,
      finish_time DATETIME,
      estimated_finish DATETIME,
      error_message TEXT,
      pages_printed INTEGER DEFAULT 0,
      category TEXT DEFAULT 'general'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS scheduled_jobs (
      id TEXT PRIMARY KEY,
      job_name TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      total_pages INTEGER DEFAULT 1,
      copies INTEGER DEFAULT 1,
      color_mode TEXT DEFAULT 'bw',
      duplex_mode TEXT DEFAULT 'single',
      paper_size TEXT DEFAULT 'A4',
      printer_id TEXT,
      user_name TEXT DEFAULT 'admin',
      scheduled_time DATETIME NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT
    )
  `);

  // Migration: add document_token to print_jobs and scheduled_jobs
  try { db.run('ALTER TABLE print_jobs ADD COLUMN document_token TEXT'); } catch (e) {}
  try { db.run('ALTER TABLE scheduled_jobs ADD COLUMN document_token TEXT'); } catch (e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS notes_library (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      total_pages INTEGER DEFAULT 0,
      category TEXT DEFAULT 'Uncategorized',
      tags TEXT DEFAULT '[]',
      downloads INTEGER DEFAULT 0,
      total_prints INTEGER DEFAULT 0,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_accessed DATETIME,
      preview_path TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notes_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      color TEXT DEFAULT '#6366f1',
      icon TEXT DEFAULT 'folder',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      event_data TEXT,
      device_id TEXT,
      device_name TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS server_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT DEFAULT 'info',
      category TEXT,
      message TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: add document_token column if not exists
  const printCols = db.exec('PRAGMA table_info(print_jobs)');
  const printHasToken = printCols[0] && printCols[0].values.some(c => c[1] === 'document_token');
  if (!printHasToken) { try { db.run("ALTER TABLE print_jobs ADD COLUMN document_token TEXT"); } catch(e) {} }
  const schedCols = db.exec('PRAGMA table_info(scheduled_jobs)');
  const schedHasToken = schedCols[0] && schedCols[0].values.some(c => c[1] === 'document_token');
  if (!schedHasToken) { try { db.run("ALTER TABLE scheduled_jobs ADD COLUMN document_token TEXT"); } catch(e) {} }

  // Insert default settings
  const defaultSettings = {
    default_paper_size: 'A4',
    default_color_mode: 'bw',
    default_duplex_mode: 'single',
    default_copies: '1',
    upload_size_limit: '50',
    max_queue_size: '100',
    auto_delete_days: '30',
    notes_library_path: path.join(DATA_DIR, 'notes-library'),
    upload_folder_path: path.join(DATA_DIR, 'uploads'),
    backup_folder_path: path.join(DATA_DIR, 'backups'),
    dark_mode: 'true',
    server_port: '3000',
    app_name: 'Print Hub',
  };

  const existingSettings = db.exec('SELECT key FROM settings');
  const existingKeys = new Set();
  if (existingSettings.length > 0) {
    existingSettings[0].values.forEach(row => existingKeys.add(row[0]));
  }

  for (const [key, value] of Object.entries(defaultSettings)) {
    if (!existingKeys.has(key)) {
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
    }
  }

  // Insert default categories if empty
  const catCount = db.exec('SELECT COUNT(*) FROM notes_categories');
  if (catCount[0].values[0][0] === 0) {
    db.run("INSERT INTO notes_categories (id, name, sort_order) VALUES (?, ?, ?)", ['cat-1', 'Semester', 1]);
    db.run("INSERT INTO notes_categories (id, name, sort_order) VALUES (?, ?, ?)", ['cat-2', 'Subject', 2]);
    db.run("INSERT INTO notes_categories (id, name, sort_order) VALUES (?, ?, ?)", ['cat-3', 'Department', 3]);
    db.run("INSERT INTO notes_categories (id, name, sort_order) VALUES (?, ?, ?)", ['cat-4', 'General', 4]);
  }

  saveDb();
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function queryAll(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (err) {
    console.error('Query error:', err, sql);
    return [];
  }
}

function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : undefined;
}

function runSql(sql, params = []) {
  try {
    db.run(sql, params);
    saveDb();
    return { changes: db.getRowsModified() };
  } catch (err) {
    console.error('Run error:', err, sql);
    return { changes: 0 };
  }
}

module.exports = { getDb, initializeDatabase, saveDb, queryAll, queryOne, runSql, DB_PATH, DATA_DIR };
