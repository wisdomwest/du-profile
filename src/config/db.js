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

  // Clean up any existing course outlines, syllabus, or exam papers
  await pruneExistingCourses();

  console.log('[DB] Database initialization complete.');
}

/**
 * Local helper to identify course outline, syllabus, and exam records for pruning.
 */
function isCourseRecord(r) {
  if (!r) return false;
  const title = (r.title || '').trim();
  const authors = (r.authors || '').trim();

  // 1. Matches course codes: 3-4 letters followed by optional spaces, then a digit (or O/o as fallback) and 2 digits (plus optional letters)
  const courseCodeRegex = /^[A-Z]{3,4}\s*[0-9O]\d{2}/i;
  if (courseCodeRegex.test(title)) {
    return true;
  }

  // 2. Authors matches 'Daystar University' exactly (case-insensitive)
  if (authors.toLowerCase() === 'daystar university') {
    return true;
  }

  // 3. Authors contains 'Department of' and 'School of' in capitalized/any case
  const authorsUpper = authors.toUpperCase();
  if (authorsUpper.includes('DEPARTMENT OF') && authorsUpper.includes('SCHOOL OF')) {
    return true;
  }

  // 4. Matches standard course outline / syllabus / marking scheme titles
  const titleLower = title.toLowerCase();
  if (
    titleLower.includes('course outline') ||
    titleLower.includes('marking scheme') ||
    titleLower.includes('course syllabus') ||
    titleLower.includes('question paper') ||
    titleLower.includes('exam paper') ||
    titleLower.includes('examination paper')
  ) {
    return true;
  }

  return false;
}

/**
 * Scans the database and prunes all pre-existing course records on startup.
 */
async function pruneExistingCourses() {
  console.log('[DB] Scanning database to prune any existing course records...');
  try {
    const rows = await dbAll('SELECT id, title, authors, publisher FROM publications');
    const courseIds = [];
    for (const r of rows) {
      if (isCourseRecord(r)) {
        courseIds.push(r.id);
      }
    }

    if (courseIds.length > 0) {
      console.log(`[DB] Found ${courseIds.length} existing course records in database. Pruning...`);
      // Delete in chunks to avoid parameter limit issues
      const chunkSize = 500;
      for (let i = 0; i < courseIds.length; i += chunkSize) {
        const chunk = courseIds.slice(i, i + chunkSize);
        const placeholders = chunk.map(() => '?').join(',');
        await dbRun(`DELETE FROM publications WHERE id IN (${placeholders})`, chunk);
      }
      console.log(`[DB] Successfully pruned ${courseIds.length} course records from database.`);
    } else {
      console.log('[DB] No existing course records found in database.');
    }
  } catch (err) {
    console.error('[DB] Failed to prune existing course records:', err.message);
  }
}

module.exports = {
  getDB,
  dbRun,
  dbAll,
  initDB,
  DB_PATH
};
