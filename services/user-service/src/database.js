const { Pool } = require('pg');
const config = require('./config');
const pool = new Pool({ connectionString: config.USER_DATABASE_URL, max: 20 });

async function migrate() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
    name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY, subject TEXT NOT NULL, payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), published_at TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS outbox_unpublished_idx ON outbox_events (created_at) WHERE published_at IS NULL;`);
}
module.exports = { pool, migrate };
