const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'reloop.db'));

// Foreign key enforcement is opt-in in SQLite
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'operator' CHECK (role IN ('operator', 'admin')),
    created_at    DATETIME NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS grades (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER REFERENCES users(id),
    item_name           TEXT,
    category            TEXT,
    grade               TEXT,
    confidence          REAL,
    decision            TEXT,
    flaws               TEXT,
    fraud_flag          INTEGER NOT NULL DEFAULT 0,
    low_confidence_flag INTEGER NOT NULL DEFAULT 0,
    estimated_value     REAL,
    green_credits       INTEGER,
    co2_saved           REAL,
    feedback            TEXT CHECK (feedback IN (NULL, 'correct', 'incorrect')),
    image_hash          TEXT,
    source              TEXT,
    created_at          DATETIME NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS exchange_listings (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    grade_id            INTEGER REFERENCES grades(id),
    item_name           TEXT,
    category            TEXT,
    grade               TEXT,
    original_decision   TEXT,
    listed_by_user_id   INTEGER REFERENCES users(id),
    status              TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'claimed', 'expired')),
    claimed_by_user_id  INTEGER REFERENCES users(id),
    listed_at           DATETIME NOT NULL DEFAULT (datetime('now')),
    claimed_at          DATETIME,
    latitude            REAL,
    longitude           REAL
  );

  CREATE TABLE IF NOT EXISTS interest_list (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER REFERENCES users(id),
    category    TEXT,
    created_at  DATETIME NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, category)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER REFERENCES users(id),
    type        TEXT NOT NULL DEFAULT 'exchange_match',
    listing_id  INTEGER REFERENCES exchange_listings(id),
    message     TEXT,
    is_read     INTEGER NOT NULL DEFAULT 0,
    created_at  DATETIME NOT NULL DEFAULT (datetime('now'))
  );
`);

// ALTER TABLE has no "IF NOT EXISTS" for columns in SQLite, and better-sqlite3
// throws if the column is already there — safe to ignore only that exact case.
function addColumnIfMissing(table, columnDef) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
  } catch (e) {
    if (!/duplicate column name/i.test(e.message)) throw e;
  }
}

addColumnIfMissing('users', 'latitude REAL');
addColumnIfMissing('users', 'longitude REAL');
addColumnIfMissing('exchange_listings', 'latitude REAL');
addColumnIfMissing('exchange_listings', 'longitude REAL');
addColumnIfMissing('exchange_listings', 'original_decision TEXT');

module.exports = db;
