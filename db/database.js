import * as SQLite from 'expo-sqlite';

const DB_NAME = 'hwpl.db';
let dbInstance = null;

/**
 * Open (or reuse) the async SQLite connection and make sure
 * every table exists. Call this once at app startup.
 */
export async function getDb() {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
  await dbInstance.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,          -- health | work | play | love
      score INTEGER NOT NULL,          -- 0-5
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      deadline TEXT,                   -- ISO date string, nullable
      status TEXT NOT NULL DEFAULT 'open', -- open | done
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const { user_version: schemaVersion } = await dbInstance.getFirstAsync('PRAGMA user_version;');
  if (schemaVersion < 1) {
    await dbInstance.runAsync('DELETE FROM ratings;');
    await dbInstance.execAsync('PRAGMA user_version = 1;');
  }
  return dbInstance;
}

/* ---------------- Ratings ---------------- */

export async function addRating(category, score, note = null) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO ratings (category, score, note) VALUES (?, ?, ?);',
    [category, score, note]
  );
}

export async function getRatingsSince(isoDate) {
  const db = await getDb();
  return db.getAllAsync(
    'SELECT * FROM ratings WHERE created_at >= ? ORDER BY created_at ASC;',
    [isoDate]
  );
}

export async function getTodayRatings() {
  const db = await getDb();
  return db.getAllAsync(
    "SELECT * FROM ratings WHERE date(created_at) = date('now');"
  );
}

export async function resetDatabase() {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM ratings;
    DELETE FROM items;
    DELETE FROM notes;
    DELETE FROM sqlite_sequence WHERE name IN ('ratings', 'items', 'notes');
  `);
}

/* ---------------- Items ---------------- */

export async function addItem(title, description, deadline) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO items (title, description, deadline) VALUES (?, ?, ?);',
    [title, description ?? null, deadline ?? null]
  );
}

export async function updateItem(id, title, description, deadline) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE items SET title = ?, description = ?, deadline = ? WHERE id = ?;',
    [title, description ?? null, deadline ?? null, id]
  );
}

export async function getOpenItems() {
  const db = await getDb();
  return db.getAllAsync(
    "SELECT * FROM items WHERE status = 'open' ORDER BY (deadline IS NULL), deadline ASC;"
  );
}

export async function getAllItems() {
  const db = await getDb();
  return db.getAllAsync('SELECT * FROM items ORDER BY created_at DESC;');
}

export async function setItemStatus(id, status) {
  const db = await getDb();
  await db.runAsync('UPDATE items SET status = ? WHERE id = ?;', [status, id]);
}

export async function deleteItem(id) {
  const db = await getDb();
  await db.runAsync('DELETE FROM items WHERE id = ?;', [id]);
}

/* ---------------- Notes ---------------- */

export async function addNote(content) {
  const db = await getDb();
  await db.runAsync('INSERT INTO notes (content) VALUES (?);', [content]);
}

export async function updateNote(id, content) {
  const db = await getDb();
  await db.runAsync('UPDATE notes SET content = ? WHERE id = ?;', [content, id]);
}

export async function getAllNotes() {
  const db = await getDb();
  return db.getAllAsync('SELECT * FROM notes ORDER BY created_at DESC;');
}

export async function deleteNote(id) {
  const db = await getDb();
  await db.runAsync('DELETE FROM notes WHERE id = ?;', [id]);
}

/* ---------------- Reports ---------------- */

const CATEGORIES = ['health', 'work', 'play', 'love'];

export async function buildReport(daysBack) {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  const rows = await getRatingsSince(since.toISOString());

  const byCategory = {};
  for (const cat of CATEGORIES) {
    const catRows = rows.filter((r) => r.category === cat);
    const avg =
      catRows.length > 0
        ? catRows.reduce((sum, r) => sum + r.score, 0) / catRows.length
        : null;
    byCategory[cat] = { average: avg, count: catRows.length, entries: catRows };
  }
  return byCategory;
}
