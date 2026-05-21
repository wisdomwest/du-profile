const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

// Resolve SQLite file path, prioritizing configured DB_PATH for Render persistent disks
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../database.db');

let dbInstance = null;

/**
 * Returns the persistent SQLite database connection instance (Singleton).
 * Configures performance optimizations (WAL mode, normal sync, busyTimeout).
 */
function getDB() {
  if (!dbInstance) {
    console.log(`[DB] Opening persistent connection to SQLite database at: ${DB_PATH}`);
    dbInstance = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('[DB] Connection failed:', err.message);
        throw err;
      }
    });

    // Performance Tuning for high-concurrency Node/Express environment
    dbInstance.configure('busyTimeout', 10000); // Wait up to 10s if DB is locked
    dbInstance.run('PRAGMA journal_mode = WAL;'); // Write-Ahead Logging for concurrent read/write
    dbInstance.run('PRAGMA synchronous = NORMAL;'); // Speed up writes safely under normal operation
    dbInstance.run('PRAGMA temp_store = MEMORY;'); // Store temporary tables in memory
  }
  return dbInstance;
}

/**
 * Executes a query that doesn't return rows (INSERT, UPDATE, DELETE).
 * Uses the persistent connection without opening/closing file handles.
 */
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDB();
    db.run(sql, params, function (err) {
      if (err) {
        console.error('[DB] Run Error:', err.message, 'SQL:', sql);
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
}

/**
 * Fetches all rows matching the query.
 * Uses the persistent connection without opening/closing file handles.
 */
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDB();
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('[DB] All Error:', err.message, 'SQL:', sql);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

/**
 * Initializes database tables and builds search/sort indices.
 */
async function initDB() {
  console.log('[DB] Running initialization routines...');
  
  // Table: publications
  await dbRun(`CREATE TABLE IF NOT EXISTS publications (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    title     TEXT,
    authors   TEXT,
    year      INTEGER,
    school    TEXT,
    type      TEXT,
    publisher TEXT,
    sdgs      TEXT,
    indexing  TEXT,
    url       TEXT,
    abstract  TEXT
  )`);

  // Table: harvest_log
  await dbRun(`CREATE TABLE IF NOT EXISTS harvest_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    ts        TEXT DEFAULT (datetime('now')),
    source    TEXT,
    community TEXT,
    count     INTEGER,
    status    TEXT
  )`);

  // Index Optimizations (Essential for solving query bottleneck)
  console.log('[DB] Ensuring database indexes exist for fast filtering and sorting...');
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_pubs_school ON publications(school);`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_pubs_year ON publications(year);`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_pubs_type ON publications(type);`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_pubs_school_year ON publications(school, year);`);
  
  console.log('[DB] Database initialization complete.');
}

module.exports = {
  getDB,
  dbRun,
  dbAll,
  initDB,
  DB_PATH
};
