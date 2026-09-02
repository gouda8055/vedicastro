// Postgres connection helper. Requires the `pg` package (in package.json) —
// Vercel installs it automatically on deploy. Reuses one connection pool
// across warm serverless invocations instead of opening a new one per request.

const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set. Add it in .env (local) or Vercel → Settings → Environment Variables.');
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 5, // serverless functions should keep pools small
    });
  }
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

module.exports = { getPool, query };
