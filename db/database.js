import * as SQLite from 'expo-sqlite';

const DB_NAME = 'hwpl.db';
const BACKUP_FORMAT = 'hwpl-backup';
const BACKUP_VERSION = 3;
let dbInstance = null;

const LEGACY_BACKUP_TABLES = {
  ratings: ['id', 'category', 'score', 'note', 'created_at'],
  items: ['id', 'title', 'description', 'deadline', 'status', 'created_at'],
  notes: ['id', 'content', 'created_at', 'is_archived', 'category'],
  birth_chart: [
    'id', 'birth_date', 'birth_time', 'latitude', 'longitude', 'place_name',
    'sun_sign', 'moon_sign', 'ascendant_sign', 'placements_json',
  ],
  monthly_themes: ['month_key', 'theme_text', 'created_at'],
};

const CHARACTER_PROGRESS_BACKUP_COLUMNS_V2 = [
  'id', 'active_character', 'owned_characters', 'gacha_pulls',
  'last_rating_date', 'streak_days',
];

const CHARACTER_PROGRESS_BACKUP_COLUMNS = [
  ...CHARACTER_PROGRESS_BACKUP_COLUMNS_V2,
  'rating_days',
];

const BACKUP_TABLES_V2 = {
  ...LEGACY_BACKUP_TABLES,
  character_progress: CHARACTER_PROGRESS_BACKUP_COLUMNS_V2,
};

const BACKUP_TABLES = {
  ...LEGACY_BACKUP_TABLES,
  character_progress: CHARACTER_PROGRESS_BACKUP_COLUMNS,
};

const DEFAULT_CHARACTER_PROGRESS = {
  id: 1,
  active_character: 'basic',
  owned_characters: JSON.stringify(['basic']),
  gacha_pulls: 0,
  last_rating_date: null,
  streak_days: 0,
  rating_days: 0,
};

const getDistinctRatingDays = (ratings) => new Set(ratings.map((row) => {
  const date = new Date(
    row.created_at.includes('T') ? row.created_at : row.created_at.replace(' ', 'T')
  );
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
})).size;

function migrateLegacyCharacterProgress(progress, ratingDays) {
  const ownedCharacters = JSON.parse(progress.owned_characters);
  const shouldUnlockLeafhead = ratingDays >= 3 && !ownedCharacters.includes('leafhead');
  if (shouldUnlockLeafhead) ownedCharacters.push('leafhead');
  return {
    ...progress,
    active_character: shouldUnlockLeafhead && progress.active_character === 'basic'
      ? 'leafhead'
      : progress.active_character,
    owned_characters: JSON.stringify(ownedCharacters),
    gacha_pulls: progress.gacha_pulls
      + Math.max(0, Math.floor(ratingDays / 7) - Math.floor(progress.streak_days / 7)),
    rating_days: ratingDays,
  };
}

export async function createDatabaseBackup() {
  const db = await getDb();
  const data = {};
  for (const table of Object.keys(BACKUP_TABLES)) {
    data[table] = await db.getAllAsync(`SELECT * FROM ${table};`);
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function validateDatabaseBackup(backup) {
  if (!backup || backup.format !== BACKUP_FORMAT || ![1, 2, BACKUP_VERSION].includes(backup.version)) {
    throw new Error('This is not a supported HWPL backup file.');
  }
  if (!backup.data || typeof backup.data !== 'object') {
    throw new Error('The backup file is missing its data.');
  }
  const tables = backup.version === 1
    ? LEGACY_BACKUP_TABLES
    : backup.version === 2
      ? BACKUP_TABLES_V2
      : BACKUP_TABLES;
  for (const [table, columns] of Object.entries(tables)) {
    const rows = backup.data[table];
    if (!Array.isArray(rows)) throw new Error(`The backup is missing ${table} records.`);
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new Error(`The backup contains an invalid ${table} record.`);
      }
      if (columns.some((column) => !Object.prototype.hasOwnProperty.call(row, column))) {
        throw new Error(`The backup contains an incomplete ${table} record.`);
      }
    }
  }
  return backup;
}

export async function restoreDatabaseBackup(backup) {
  validateDatabaseBackup(backup);
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM ratings;
      DELETE FROM items;
      DELETE FROM notes;
      DELETE FROM birth_chart;
      DELETE FROM monthly_themes;
      DELETE FROM character_progress;
      DELETE FROM sqlite_sequence WHERE name IN ('ratings', 'items', 'notes');
    `);
    for (const [table, columns] of Object.entries(BACKUP_TABLES)) {
      const rows = backup.data[table] ?? (table === 'character_progress' ? [DEFAULT_CHARACTER_PROGRESS] : []);
      for (const row of rows) {
        const placeholders = columns.map(() => '?').join(', ');
        const values = columns.map((column) => row[column] ?? null);
        if (table === 'character_progress' && backup.version < BACKUP_VERSION) {
          const ratingDays = getDistinctRatingDays(backup.data.ratings);
          const migratedProgress = migrateLegacyCharacterProgress(
            { ...DEFAULT_CHARACTER_PROGRESS, ...row },
            ratingDays
          );
          values[columns.indexOf('active_character')] = migratedProgress.active_character;
          values[columns.indexOf('owned_characters')] = migratedProgress.owned_characters;
          values[columns.indexOf('gacha_pulls')] = migratedProgress.gacha_pulls;
          values[columns.indexOf('rating_days')] = migratedProgress.rating_days;
        } else if (table === 'character_progress') {
          values[columns.indexOf('rating_days')] = row.rating_days ?? 0;
        }
        await db.runAsync(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders});`,
          values
        );
      }
    }
    await db.runAsync('INSERT OR IGNORE INTO character_progress (id) VALUES (1);');
  });
}

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
    CREATE TABLE IF NOT EXISTS birth_chart (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      birth_date TEXT NOT NULL,
      birth_time TEXT,
      latitude REAL,
      longitude REAL,
      place_name TEXT,
      sun_sign TEXT,
      moon_sign TEXT,
      ascendant_sign TEXT
    );

    CREATE TABLE IF NOT EXISTS monthly_themes (
      month_key TEXT PRIMARY KEY,
      theme_text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS character_progress (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      active_character TEXT NOT NULL DEFAULT 'basic',
      owned_characters TEXT NOT NULL DEFAULT '["basic"]',
      gacha_pulls INTEGER NOT NULL DEFAULT 0,
      last_rating_date TEXT,
      streak_days INTEGER NOT NULL DEFAULT 0
    );
  `);
  await dbInstance.runAsync(
    'INSERT OR IGNORE INTO character_progress (id) VALUES (1);'
  );
  let addedRatingDays = false;
  try {
    await dbInstance.execAsync(
      'ALTER TABLE character_progress ADD COLUMN rating_days INTEGER NOT NULL DEFAULT 0;'
    );
    addedRatingDays = true;
  } catch (error) {
    if (!error.message.includes('duplicate column name')) throw error;
  }
  if (addedRatingDays) {
    const ratingRows = await dbInstance.getAllAsync(
      "SELECT DISTINCT date(created_at, 'localtime') AS rating_date FROM ratings;"
    );
    const progress = await dbInstance.getFirstAsync(
      'SELECT * FROM character_progress WHERE id = 1;'
    );
    const ownedCharacters = JSON.parse(progress.owned_characters);
    const shouldUnlockLeafhead = ratingRows.length >= 3 && !ownedCharacters.includes('leafhead');
    if (shouldUnlockLeafhead) ownedCharacters.push('leafhead');
    const gachaPulls = progress.gacha_pulls
      + Math.max(0, Math.floor(ratingRows.length / 7) - Math.floor(progress.streak_days / 7));
    await dbInstance.runAsync(
      `UPDATE character_progress
       SET active_character = ?, owned_characters = ?, gacha_pulls = ?, rating_days = ?
       WHERE id = 1;`,
      [
        shouldUnlockLeafhead && progress.active_character === 'basic' ? 'leafhead' : progress.active_character,
        JSON.stringify(ownedCharacters),
        gachaPulls,
        ratingRows.length,
      ]
    );
  }
  const { user_version: schemaVersion } = await dbInstance.getFirstAsync('PRAGMA user_version;');
  if (schemaVersion < 1) {
    await dbInstance.runAsync('DELETE FROM ratings;');
    await dbInstance.execAsync('PRAGMA user_version = 1;');
  }
  if (schemaVersion < 2) {
    await dbInstance.execAsync(`
      ALTER TABLE notes ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;
      PRAGMA user_version = 2;
    `);
  }
  if (schemaVersion < 3) {
    await dbInstance.execAsync(`
      ALTER TABLE notes ADD COLUMN category TEXT;
      PRAGMA user_version = 3;
    `);
  }
  // placements_json added after initial release — guard with try/catch
  // since SQLite has no "ADD COLUMN IF NOT EXISTS".
  try {
    await dbInstance.execAsync('ALTER TABLE birth_chart ADD COLUMN placements_json TEXT;');
  } catch (e) {
    // column already exists — safe to ignore
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

const getLocalDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export async function getCharacterProgress() {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT * FROM character_progress WHERE id = 1;');
  return {
    ...row,
    owned_characters: JSON.parse(row.owned_characters),
  };
}

async function applyRatingMilestoneRewards(db, progress, ratingDays, ratedToday) {
  const ownedCharacters = [...progress.owned_characters];
  const unlockedCharacters = [];
  if (ratingDays >= 3 && !ownedCharacters.includes('leafhead')) {
    ownedCharacters.push('leafhead');
    unlockedCharacters.push('leafhead');
  }
  const activeCharacter = unlockedCharacters.includes('leafhead')
    ? 'leafhead'
    : progress.active_character;
  const newlyEarnedPulls = Math.max(
    0,
    Math.floor(ratingDays / 7) - Math.floor(progress.rating_days / 7)
  );
  const earnedGachaPull = newlyEarnedPulls > 0;
  const gachaPulls = progress.gacha_pulls + newlyEarnedPulls;
  const lastRatingDateUpdate = ratedToday ? ', last_rating_date = ?' : '';
  const values = [activeCharacter, JSON.stringify(ownedCharacters), gachaPulls, ratingDays];
  if (ratedToday) values.push(getLocalDateKey(new Date()));
  await db.runAsync(
    `UPDATE character_progress
     SET active_character = ?, owned_characters = ?, gacha_pulls = ?, rating_days = ?${lastRatingDateUpdate}
     WHERE id = 1;`,
    values
  );

  return {
    progress: {
      ...progress,
      active_character: activeCharacter,
      owned_characters: ownedCharacters,
      gacha_pulls: gachaPulls,
      last_rating_date: ratedToday ? getLocalDateKey(new Date()) : progress.last_rating_date,
      rating_days: ratingDays,
    },
    unlockedCharacters,
    earnedGachaPull,
  };
}

async function countRatedDays(db) {
  const { rating_days: ratingDays } = await db.getFirstAsync(
    "SELECT COUNT(DISTINCT date(created_at, 'localtime')) AS rating_days FROM ratings;"
  );
  return ratingDays;
}

export async function recordDailyRatingProgress() {
  const db = await getDb();
  const today = getLocalDateKey(new Date());
  const progress = await getCharacterProgress();
  if (progress.last_rating_date === today) {
    return { progress, unlockedCharacters: [], earnedGachaPull: false };
  }
  return applyRatingMilestoneRewards(db, progress, await countRatedDays(db), true);
}

export async function recordHistoricalRatingProgress() {
  const db = await getDb();
  const progress = await getCharacterProgress();
  return applyRatingMilestoneRewards(db, progress, await countRatedDays(db), false);
}

export async function setActiveCharacter(characterId) {
  const db = await getDb();
  const progress = await getCharacterProgress();
  if (!progress.owned_characters.includes(characterId)) {
    throw new Error('You have not unlocked this character.');
  }
  await db.runAsync('UPDATE character_progress SET active_character = ? WHERE id = 1;', [characterId]);
  return { ...progress, active_character: characterId };
}

export async function drawCharacter(characterPool) {
  const db = await getDb();
  const progress = await getCharacterProgress();
  if (progress.gacha_pulls < 1) {
    throw new Error('You do not have any gacha pulls.');
  }
  const available = characterPool.filter((character) => !progress.owned_characters.includes(character.id));
  if (available.length === 0) {
    throw new Error('You have already unlocked every available character.');
  }

  const character = available[Math.floor(Math.random() * available.length)];
  const ownedCharacters = [...progress.owned_characters, character.id];
  const gachaPulls = progress.gacha_pulls - 1;
  await db.runAsync(
    `UPDATE character_progress
     SET owned_characters = ?, gacha_pulls = ?
     WHERE id = 1;`,
    [JSON.stringify(ownedCharacters), gachaPulls]
  );
  return {
    character,
    progress: { ...progress, owned_characters: ownedCharacters, gacha_pulls: gachaPulls },
  };
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

export async function getRatedDaysInMonth(monthKey) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    "SELECT DISTINCT date(created_at, 'localtime') AS rating_date FROM ratings WHERE strftime('%Y-%m', created_at, 'localtime') = ?;",
    [monthKey]
  );
  return rows.map((row) => row.rating_date);
}

export async function getRatingsForDay(dateKey) {
  const db = await getDb();
  return db.getAllAsync(
    "SELECT * FROM ratings WHERE date(created_at, 'localtime') = ? ORDER BY created_at DESC, id DESC;",
    [dateKey]
  );
}

export async function updateRatingsForDay(dateKey, scores, note) {
  const db = await getDb();
  const [year, month, day] = dateKey.split('-').map(Number);
  const recordedAt = new Date(year, month - 1, day, 12).toISOString().replace('T', ' ').slice(0, 19);

  await db.withTransactionAsync(async () => {
    for (const [category, score] of Object.entries(scores)) {
      const existing = await db.getFirstAsync(
        "SELECT id FROM ratings WHERE category = ? AND date(created_at, 'localtime') = ? LIMIT 1;",
        [category, dateKey]
      );

      if (existing) {
        await db.runAsync(
          "UPDATE ratings SET score = ?, note = ? WHERE category = ? AND date(created_at, 'localtime') = ?;",
          [score, note, category, dateKey]
        );
      } else {
        await db.runAsync(
          'INSERT INTO ratings (category, score, note, created_at) VALUES (?, ?, ?, ?);',
          [category, score, note, recordedAt]
        );
      }
    }
  });
}

export async function resetDatabase() {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM ratings;
    DELETE FROM items;
    DELETE FROM notes;
    DELETE FROM birth_chart;
    DELETE FROM monthly_themes;
    DELETE FROM character_progress;
    DELETE FROM sqlite_sequence WHERE name IN ('ratings', 'items', 'notes');
  `);
  await db.runAsync('INSERT INTO character_progress (id) VALUES (1);');
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

export async function getCompletedItems() {
  const db = await getDb();
  return db.getAllAsync(
    "SELECT * FROM items WHERE status = 'done' ORDER BY created_at DESC;"
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

export function parseNoteTags(categoryValue) {
  if (Array.isArray(categoryValue)) {
    return categoryValue.map((tag) => String(tag).trim()).filter(Boolean);
  }

  if (!categoryValue) {
    return [];
  }

  return String(categoryValue)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function serializeNoteTags(categoryValue) {
  const tags = [...new Set(parseNoteTags(categoryValue))];
  return tags.length > 0 ? tags.join(',') : null;
}

export async function addNote(content, category = null) {
  const db = await getDb();
  const tags = serializeNoteTags(category);
  await db.runAsync('INSERT INTO notes (content, category) VALUES (?, ?);', [content, tags]);
}

export async function updateNote(id, content, category = null) {
  const db = await getDb();
  const tags = serializeNoteTags(category);
  await db.runAsync('UPDATE notes SET content = ?, category = ? WHERE id = ?;', [content, tags, id]);
}

export async function getAllNotes() {
  const db = await getDb();
  return db.getAllAsync('SELECT * FROM notes ORDER BY created_at DESC;');
}

export async function getActiveNotes() {
  const db = await getDb();
  return db.getAllAsync('SELECT * FROM notes WHERE is_archived = 0 ORDER BY created_at DESC;');
}

export async function getTaggedNotesInRange(startDate, endDate) {
  const db = await getDb();
  return db.getAllAsync(
    "SELECT * FROM notes WHERE is_archived = 0 AND category IS NOT NULL AND datetime(created_at) >= datetime(?) AND datetime(created_at) <= datetime(?) ORDER BY created_at DESC;",
    [startDate, endDate]
  );
}

export async function getArchivedNotes() {
  const db = await getDb();
  return db.getAllAsync('SELECT * FROM notes WHERE is_archived = 1 ORDER BY created_at DESC;');
}

export async function setNoteArchived(id, isArchived) {
  const db = await getDb();
  await db.runAsync('UPDATE notes SET is_archived = ? WHERE id = ?;', [isArchived ? 1 : 0, id]);
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
/* ---------------- Birth chart & astrology ---------------- */

export async function saveBirthChart(chart) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO birth_chart (id, birth_date, birth_time, latitude, longitude, place_name, sun_sign, moon_sign, ascendant_sign, placements_json)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       birth_date=excluded.birth_date, birth_time=excluded.birth_time,
       latitude=excluded.latitude, longitude=excluded.longitude,
       place_name=excluded.place_name, sun_sign=excluded.sun_sign,
       moon_sign=excluded.moon_sign, ascendant_sign=excluded.ascendant_sign,
       placements_json=excluded.placements_json;`,
    [chart.birthDate, chart.birthTime ?? null, chart.latitude ?? null,
     chart.longitude ?? null, chart.placeName ?? null,
     chart.sunSign, chart.moonSign ?? null, chart.ascendantSign ?? null,
     chart.placements ? JSON.stringify(chart.placements) : null]
  );
}

export async function getBirthChart() {
  const db = await getDb();
  return db.getFirstAsync('SELECT * FROM birth_chart WHERE id = 1;');
}

export async function getCachedMonthlyTheme(monthKey) {
  const db = await getDb();
  return db.getFirstAsync('SELECT * FROM monthly_themes WHERE month_key = ?;', [monthKey]);
}

export async function saveMonthlyTheme(monthKey, themeText) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO monthly_themes (month_key, theme_text) VALUES (?, ?)
     ON CONFLICT(month_key) DO UPDATE SET theme_text = excluded.theme_text, created_at = datetime('now');`,
    [monthKey, themeText]
  );
}