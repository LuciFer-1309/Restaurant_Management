const { Pool } = require('pg');
require('dotenv').config();

// Determine if SSL is required (e.g. for Supabase, hosted cloud, or when DB_SSL is explicitly true)
const isSSL =
  process.env.DB_SSL === 'true' ||
  (process.env.DATABASE_URL &&
    (process.env.DATABASE_URL.includes('supabase.co') ||
      process.env.DATABASE_URL.includes('pooler.supabase.com')));

// Pool configuration supporting either a unified connection string (DATABASE_URL)
// or individual environment variables (DB_HOST, DB_PORT, etc.)
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: isSSL ? { rejectUnauthorized: false } : false,
      max: parseInt(process.env.DB_MAX_CONNECTIONS, 10) || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      database: process.env.DB_NAME || 'restaurant_management_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      ssl: isSSL ? { rejectUnauthorized: false } : false,
      max: parseInt(process.env.DB_MAX_CONNECTIONS, 10) || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

const pool = new Pool(poolConfig);

// Pool error event listener (never logs credentials)
pool.on('error', (err) => {
  console.error('[Database Pool Error]: Unexpected error on idle client:', err.message);
});

/**
 * Execute parameterized query helper
 * @param {string} text - SQL statement
 * @param {Array} params - Parameters for SQL statement
 */
const query = (text, params) => pool.query(text, params);

/**
 * Get a client from the pool for manual transactions (BEGIN, COMMIT, ROLLBACK)
 */
const getClient = () => pool.connect();

module.exports = {
  pool,
  query,
  getClient,
};
