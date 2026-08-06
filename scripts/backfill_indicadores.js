require('dotenv').config();
const { pool, query } = require('../src/config/db');
const { processarResposta } = require('../src/services/calculo.service');

/**
 * Encontra respostas CONCLUÍDAS que não têm score calculado (normalmente
 * porque foram coletadas antes do motor de cálculo existir, ou por qualquer
 * outra falha pontual) e roda o motor de cálculo pra elas — de forma
 * totalmente idempotente e segura de rodar em todo deploy, exatamente como
 * migrations e seed. Se não houver nada pendente, não faz nada.
 */
async function reprocessarRespostasOrfas() {
  const { rows: pendentes } = await query(
    `SELECT r.id AS resposta_id, r.pesquisa_cliente_id, r.ano_mes
     FROM respostas r
     LEFT JOIN scores_calculados sc ON sc.resposta_id = r.id
     WHERE r.concluida = true AND sc.id IS NULL`
  );

  if (pendentes.length === 0) {
    console.log('[SIGESC][BACKFILL] Nenhuma resposta pendente de cálculo. Nada a fazer.');
    await pool.end();
    return;
  }

  console.log(`[SIGESC][BACKFILL] Encontradas ${pendentes.length} resposta(s) sem score calculado. Reprocessando...`);

  let sucesso = 0;
  let falhas = 0;

  for (const r of pendentes) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await processarResposta(client, {
        respostaId: r.resposta_id,
        pesquisaClienteId: r.pesquisa_cliente_id,
        anoMes: r.ano_mes,
      });
      await client.query('COMMIT');
      sucesso++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[SIGESC][BACKFILL] ❌ Falha ao reprocessar resposta ${r.resposta_id}:`, err.message);
      falhas++;
    } finally {
      client.release();
    }
  }

  console.log(`[SIGESC][BACKFILL] Concluído. ${sucesso} recalculada(s) com sucesso, ${falhas} falha(s).`);
  await pool.end();
}

reprocessarRespostasOrfas().catch((err) => {
  console.error('[SIGESC][BACKFILL] Erro fatal:', err);
  process.exit(1);
});
