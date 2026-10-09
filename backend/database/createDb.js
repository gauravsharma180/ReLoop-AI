// Run once (npm run setup-db) before the server starts: connects to the
// default 'postgres' maintenance database as the superuser and creates the
// app database if it doesn't exist yet. Lets a fresh checkout go from "only
// a password in .env" to a ready-to-migrate Postgres instance.
require('dotenv').config();
const { Client } = require('pg');

const APP_DB_NAME = 'reloop_ai';

async function main() {
  const client = new Client({
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT) || 5432,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: 'postgres'
  });

  await client.connect();

  try {
    const { rows } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [APP_DB_NAME]);

    if (rows.length > 0) {
      console.log(`Database "${APP_DB_NAME}" already exists — nothing to do.`);
      return;
    }

    // CREATE DATABASE can't take a placeholder parameter — the name is a
    // fixed constant above, never user input, so building it into the
    // statement text is safe here.
    await client.query(`CREATE DATABASE ${APP_DB_NAME}`);
    console.log(`Created database "${APP_DB_NAME}".`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('Database setup failed:', e.message);
  process.exit(1);
});
