require('dotenv').config();
const { Pool, types } = require('pg');

// pg returns NUMERIC/DECIMAL (OID 1700) and BIGINT (OID 20, what COUNT(*)
// and SUM() of an INTEGER column come back as) as strings by default —
// large enough int8 values can't round-trip through a JS number safely.
// This app never approaches that range, and a stray string flowing into
// `total += row.value`-style arithmetic (analytics.js, server.js's
// /impact) would silently turn addition into concatenation. Parsing both
// back to numbers here, once, keeps every existing call site correct
// without touching them.
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));
types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10)));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('operator', 'admin')),
      latitude      NUMERIC(10,2),
      longitude     NUMERIC(10,2),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS grades (
      id                  SERIAL PRIMARY KEY,
      user_id             INTEGER REFERENCES users(id),
      item_name           TEXT,
      category            TEXT,
      grade               TEXT,
      confidence          NUMERIC(10,2),
      decision            TEXT,
      flaws               JSONB,
      fraud_flag          BOOLEAN NOT NULL DEFAULT false,
      low_confidence_flag BOOLEAN NOT NULL DEFAULT false,
      estimated_value     NUMERIC(10,2),
      green_credits       INTEGER,
      co2_saved           NUMERIC(10,2),
      feedback            TEXT CHECK (feedback IN (NULL, 'correct', 'incorrect')),
      image_hash          TEXT,
      source              TEXT,
      review_status       TEXT NOT NULL DEFAULT 'auto_routed',
      resolved_at         TIMESTAMPTZ,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS exchange_listings (
      id                  SERIAL PRIMARY KEY,
      grade_id            INTEGER REFERENCES grades(id),
      item_name           TEXT,
      category            TEXT,
      grade               TEXT,
      original_decision   TEXT,
      listed_by_user_id   INTEGER REFERENCES users(id),
      status              TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'claimed', 'expired')),
      claimed_by_user_id  INTEGER REFERENCES users(id),
      listed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      claimed_at          TIMESTAMPTZ,
      expires_at          TIMESTAMPTZ,
      p2p_price           NUMERIC(10,2),
      window_hours        INTEGER,
      latitude            NUMERIC(10,2),
      longitude           NUMERIC(10,2)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS interest_list (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id),
      category    TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, category)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id),
      type        TEXT NOT NULL DEFAULT 'exchange_match',
      listing_id  INTEGER REFERENCES exchange_listings(id),
      message     TEXT,
      is_read     BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_grades_user_id ON grades(user_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_grades_user_id_created_at ON grades(user_id, created_at);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_exchange_listings_status_expires_at ON exchange_listings(status, expires_at);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_exchange_listings_listed_by_user_id ON exchange_listings(listed_by_user_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_exchange_listings_claimed_by_user_id ON exchange_listings(claimed_by_user_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_interest_list_category ON interest_list(category);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_user_id_is_read ON notifications(user_id, is_read);');
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  initDb
};
