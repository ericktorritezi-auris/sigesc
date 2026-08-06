const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';

// Railway exige SSL nas conexões externas, mas não na rede interna do próprio projeto.
// Detectamos isso automaticamente pela variável de ambiente PGSSLMODE ou pela URL.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Falha alto e cedo: sem banco configurado, o app não deve nem tentar subir.
  console.error('[SIGESC] ERRO FATAL: variável DATABASE_URL não configurada.');
  process.exit(1);
}

const needsSSL = isProduction && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString,
  ssl: needsSSL ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[SIGESC] Erro inesperado no pool do PostgreSQL:', err.message);
});

/**
 * Executa uma query parametrizada.
 * @param {string} text - SQL com placeholders $1, $2...
 * @param {Array} params
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production') {
    console.log('[SIGESC][SQL]', { text, duration, rows: result.rowCount });
  }
  return result;
}

/**
 * Verifica se a conexão com o banco está saudável.
 */
async function checkConnection() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (err) {
    console.error('[SIGESC] Falha ao conectar no banco:', err.message);
    return false;
  }
}

module.exports = { pool, query, checkConnection };
