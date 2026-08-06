require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          SERIAL PRIMARY KEY,
      filename    VARCHAR(255) NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getAppliedMigrations() {
  const { rows } = await pool.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map((r) => r.filename));
}

async function runMigrations() {
  console.log('[SIGESC][MIGRATE] Iniciando execução de migrations...');
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const dir = __dirname;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // 001_, 002_... garante ordem correta

  let executadas = 0;

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[SIGESC][MIGRATE] ⏭  Já aplicada: ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`[SIGESC][MIGRATE] ✅ Aplicada: ${file}`);
      executadas++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[SIGESC][MIGRATE] ❌ Falha em ${file}:`, err.message);
      client.release();
      process.exit(1);
    } finally {
      client.release();
    }
  }

  console.log(`[SIGESC][MIGRATE] Concluído. ${executadas} nova(s) migration(s) aplicada(s).`);
  await pool.end();
}

runMigrations().catch((err) => {
  console.error('[SIGESC][MIGRATE] Erro fatal:', err);
  process.exit(1);
});
