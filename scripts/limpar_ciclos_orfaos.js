require('dotenv').config();
const { pool, query } = require('../src/config/db');

/**
 * Remove ciclos que ficaram sem nenhuma pesquisa vinculada — normalmente
 * porque a única pesquisa daquele ciclo foi excluída (a exclusão já limpa
 * isso automaticamente a partir de agora, mas ciclos que ficaram órfãos
 * ANTES dessa correção existir precisam ser limpos uma vez). Idempotente e
 * seguro de rodar em todo deploy, exatamente como migrations e seed.
 */
async function limparCiclosOrfaos() {
  const { rows } = await query(
    `SELECT c.id, c.titulo FROM ciclos_pesquisa c
     WHERE NOT EXISTS (SELECT 1 FROM pesquisas p WHERE p.ciclo_id = c.id)`
  );

  if (rows.length === 0) {
    console.log('[SIGESC][LIMPEZA] Nenhum ciclo órfão encontrado. Nada a fazer.');
    await pool.end();
    return;
  }

  console.log(`[SIGESC][LIMPEZA] Encontrados ${rows.length} ciclo(s) órfão(s) (sem nenhuma pesquisa vinculada). Removendo...`);
  rows.forEach((c) => console.log(`  - "${c.titulo}" (${c.id})`));

  await query(
    `DELETE FROM ciclos_pesquisa WHERE id = ANY($1::uuid[])`,
    [rows.map((c) => c.id)]
  );

  console.log(`[SIGESC][LIMPEZA] Concluído. ${rows.length} ciclo(s) removido(s).`);
  await pool.end();
}

limparCiclosOrfaos().catch((err) => {
  console.error('[SIGESC][LIMPEZA] Erro fatal:', err);
  process.exit(1);
});
