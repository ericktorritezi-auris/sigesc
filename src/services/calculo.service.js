const { query } = require('../config/db');

/**
 * Motor de cálculo SIGESC.
 *
 * Regra de negócio fixa (não deve ser alterada por configuração de gestor):
 *   Score Geral = (ISA × 30%) + (ISE × 25%) + (IST × 25%) + (ISV × 20%)
 *
 * Os pesos e o indicador gerado por bloco vêm de `pesquisa_blocos`
 * (colunas `peso_no_score` e `indicador_gerado`), não são hardcoded aqui —
 * isso garante que o motor de cálculo continua correto mesmo se a
 * metodologia (src/config/metodologia.js) mudar no futuro.
 */

/**
 * Calcula ISA/ISE/IST/ISV/Score Geral de UMA resposta específica, a partir
 * das respostas_itens que ela já tem gravadas, e grava em scores_calculados.
 *
 * Deve ser chamado dentro da MESMA transação da gravação da resposta
 * (recebe `client`, não usa o pool direto) — se o cálculo falhar, a
 * resposta inteira deve dar rollback junto, nunca ficar "sem score".
 */
async function calcularScoresResposta(client, respostaId) {
  const { rows: medias } = await client.query(
    `SELECT pb.indicador_gerado, pb.peso_no_score, AVG(pri.valor_numerico)::numeric(4,2) AS media
     FROM respostas_itens pri
     JOIN pesquisa_perguntas pp ON pp.id = pri.pergunta_id
     JOIN pesquisa_blocos pb ON pb.id = pp.bloco_id
     WHERE pri.resposta_id = $1
       AND pp.tipo = 'escala_0_10'
       AND pb.indicador_gerado IS NOT NULL
     GROUP BY pb.indicador_gerado, pb.peso_no_score`,
    [respostaId]
  );

  const porIndicador = {};
  for (const linha of medias) {
    porIndicador[linha.indicador_gerado] = { media: Number(linha.media), peso: Number(linha.peso_no_score) };
  }

  const isa = porIndicador.ISA?.media ?? null;
  const ise = porIndicador.ISE?.media ?? null;
  const ist = porIndicador.IST?.media ?? null;
  const isv = porIndicador.ISV?.media ?? null;

  // Score Geral só é calculado se os 4 indicadores existirem — do contrário,
  // uma pesquisa com bloco vazio geraria um número artificialmente baixo/alto.
  let scoreGeral = null;
  if (isa !== null && ise !== null && ist !== null && isv !== null) {
    const pesoIsa = porIndicador.ISA.peso;
    const pesoIse = porIndicador.ISE.peso;
    const pesoIst = porIndicador.IST.peso;
    const pesoIsv = porIndicador.ISV.peso;
    scoreGeral = Number((isa * pesoIsa + ise * pesoIse + ist * pesoIst + isv * pesoIsv).toFixed(2));
  }

  await client.query(
    `INSERT INTO scores_calculados (resposta_id, isa, ise, ist, isv, score_geral)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (resposta_id) DO UPDATE SET
       isa = EXCLUDED.isa, ise = EXCLUDED.ise, ist = EXCLUDED.ist, isv = EXCLUDED.isv,
       score_geral = EXCLUDED.score_geral, calculado_em = now()`,
    [respostaId, isa, ise, ist, isv, scoreGeral]
  );

  return { isa, ise, ist, isv, scoreGeral };
}

/**
 * Recalcula o indicador mensal agregado (indicadores_mensais) de um cliente
 * específico, dentro de um ano_mes específico — usando a MÉDIA de TODAS as
 * respostas concluídas daquele cliente naquele mês (não é incremental:
 * cada nova resposta faz o sistema recalcular a média do zero, garantindo
 * que o número está sempre exatamente correto, mesmo em caso de reprocessamento).
 */
/**
 * Recalcula o indicador mensal agregado (indicadores_mensais) de um cliente
 * específico, dentro de um ano_mes específico — usando a MÉDIA de TODAS as
 * respostas concluídas daquele cliente naquele mês (não é incremental:
 * cada nova resposta faz o sistema recalcular a média do zero, garantindo
 * que o número está sempre exatamente correto, mesmo em caso de reprocessamento).
 *
 * TRAVA DE CONCORRÊNCIA: usa pg_advisory_xact_lock chaveado por
 * (pesquisa_cliente_id + ano_mes) para garantir que, se duas respostas do
 * MESMO cliente no MESMO mês chegarem ao mesmo tempo (ex: vários respondentes
 * de um município enviando quase simultaneamente), a segunda espera a
 * primeira terminar antes de ler e recalcular a média — sem isso, a leitura
 * de uma poderia não ver a escrita da outra ainda não confirmada, e uma
 * sobrescreveria o resultado da outra (perda silenciosa de dado agregado,
 * mesmo com a resposta individual gravada corretamente). A trava é liberada
 * automaticamente no fim da transação — não precisa de destrava manual.
 */
async function atualizarIndicadorMensal(client, pesquisaClienteId, anoMes) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${pesquisaClienteId}:${anoMes}`]);

  const { rows } = await client.query(
    `SELECT
       AVG(sc.isa)::numeric(4,2) AS isa,
       AVG(sc.ise)::numeric(4,2) AS ise,
       AVG(sc.ist)::numeric(4,2) AS ist,
       AVG(sc.isv)::numeric(4,2) AS isv,
       AVG(sc.score_geral)::numeric(4,2) AS score_geral,
       COUNT(*) AS qtd_respostas
     FROM scores_calculados sc
     JOIN respostas r ON r.id = sc.resposta_id
     WHERE r.pesquisa_cliente_id = $1 AND r.ano_mes = $2 AND r.concluida = true AND sc.score_geral IS NOT NULL`,
    [pesquisaClienteId, anoMes]
  );

  const agregado = rows[0];

  await client.query(
    `INSERT INTO indicadores_mensais (pesquisa_cliente_id, ano_mes, isa, ise, ist, isv, score_geral, qtd_respostas, atualizado_em)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
     ON CONFLICT (pesquisa_cliente_id, ano_mes) DO UPDATE SET
       isa = EXCLUDED.isa, ise = EXCLUDED.ise, ist = EXCLUDED.ist, isv = EXCLUDED.isv,
       score_geral = EXCLUDED.score_geral, qtd_respostas = EXCLUDED.qtd_respostas, atualizado_em = now()`,
    [
      pesquisaClienteId,
      anoMes,
      agregado.isa,
      agregado.ise,
      agregado.ist,
      agregado.isv,
      agregado.score_geral,
      parseInt(agregado.qtd_respostas, 10),
    ]
  );

  return agregado;
}

/**
 * Função de conveniência: dispara os dois passos acima em sequência,
 * pensada para ser chamada logo após a gravação de uma resposta.
 */
async function processarResposta(client, { respostaId, pesquisaClienteId, anoMes }) {
  const scores = await calcularScoresResposta(client, respostaId);
  const indicadorMensal = await atualizarIndicadorMensal(client, pesquisaClienteId, anoMes);
  return { scores, indicadorMensal };
}

/**
 * ISC consolidado por Ciclo, mês a mês — soma TODAS as pesquisas vinculadas
 * ao ciclo (inclusive de empresas diferentes), tratando como fonte única.
 * É esta função que sustenta o gráfico de evolução mensal do Sprint 5.
 */
async function buscarEvolucaoCiclo(cicloId) {
  const { rows } = await query(
    `SELECT im.ano_mes,
            AVG(im.score_geral)::numeric(4,2) AS isc,
            AVG(im.isa)::numeric(4,2) AS isa,
            AVG(im.ise)::numeric(4,2) AS ise,
            AVG(im.ist)::numeric(4,2) AS ist,
            AVG(im.isv)::numeric(4,2) AS isv,
            COUNT(DISTINCT im.pesquisa_cliente_id) AS qtd_clientes_respondentes,
            SUM(im.qtd_respostas) AS qtd_respostas_total
     FROM indicadores_mensais im
     JOIN pesquisa_clientes pc ON pc.id = im.pesquisa_cliente_id
     JOIN pesquisas p ON p.id = pc.pesquisa_id
     WHERE p.ciclo_id = $1
     GROUP BY im.ano_mes
     ORDER BY im.ano_mes ASC`,
    [cicloId]
  );
  return rows;
}

/**
 * Ranking de clientes de um Ciclo num mês específico (ou no mês mais
 * recente disponível, se ano_mes não for informado) — maior para o menor.
 */
async function buscarRankingClientesCiclo(cicloId, anoMes) {
  const anoMesFinal =
    anoMes ||
    (
      await query(
        `SELECT MAX(im.ano_mes) AS ultimo FROM indicadores_mensais im
         JOIN pesquisa_clientes pc ON pc.id = im.pesquisa_cliente_id
         JOIN pesquisas p ON p.id = pc.pesquisa_id
         WHERE p.ciclo_id = $1`,
        [cicloId]
      )
    ).rows[0].ultimo;

  if (!anoMesFinal) return { anoMes: null, ranking: [] };

  const { rows } = await query(
    `SELECT pc.id AS pesquisa_cliente_id, pc.nome_cliente, e.nome AS empresa_nome,
            im.isa, im.ise, im.ist, im.isv, im.score_geral, im.qtd_respostas
     FROM indicadores_mensais im
     JOIN pesquisa_clientes pc ON pc.id = im.pesquisa_cliente_id
     JOIN pesquisas p ON p.id = pc.pesquisa_id
     JOIN empresas e ON e.id = p.empresa_id
     WHERE p.ciclo_id = $1 AND im.ano_mes = $2
     ORDER BY im.score_geral DESC`,
    [cicloId, anoMesFinal]
  );

  return { anoMes: anoMesFinal, ranking: rows };
}

/**
 * Classifica um score geral na faixa de saúde padrão do SIGESC — 6 faixas,
 * v1.3 (07/08/2026). Mesmos limiares usados em toda a experiência (Dashboard,
 * PDF executivo, Modo Apresentação, Análises).
 */
function faixaDeSaude(scoreGeral) {
  const v = Number(scoreGeral);
  if (v >= 9.5) return 'excelencia';
  if (v >= 9.0) return 'muito_saudavel';
  if (v >= 8.0) return 'saudavel';
  if (v >= 7.0) return 'em_atencao';
  if (v >= 6.0) return 'critico';
  return 'alto_risco';
}

/**
 * Distribuição da carteira do Ciclo por faixa de saúde, num mês específico
 * (ou no mês mais recente disponível, se não informado).
 */
async function buscarDistribuicaoSaude(cicloId, anoMes) {
  const anoMesFinal = anoMes || (await buscarUltimoAnoMesCiclo(cicloId));
  const distribuicaoVazia = { excelencia: 0, muito_saudavel: 0, saudavel: 0, em_atencao: 0, critico: 0, alto_risco: 0 };
  if (!anoMesFinal) return { anoMes: null, distribuicao: distribuicaoVazia };

  const { rows } = await query(
    `SELECT im.score_geral
     FROM indicadores_mensais im
     JOIN pesquisa_clientes pc ON pc.id = im.pesquisa_cliente_id
     JOIN pesquisas p ON p.id = pc.pesquisa_id
     WHERE p.ciclo_id = $1 AND im.ano_mes = $2`,
    [cicloId, anoMesFinal]
  );

  const distribuicao = { ...distribuicaoVazia };
  rows.forEach((r) => { distribuicao[faixaDeSaude(r.score_geral)]++; });

  return { anoMes: anoMesFinal, distribuicao, total: rows.length };
}

async function buscarUltimoAnoMesCiclo(cicloId) {
  const { rows } = await query(
    `SELECT MAX(im.ano_mes) AS ultimo FROM indicadores_mensais im
     JOIN pesquisa_clientes pc ON pc.id = im.pesquisa_cliente_id
     JOIN pesquisas p ON p.id = pc.pesquisa_id
     WHERE p.ciclo_id = $1`,
    [cicloId]
  );
  return rows[0].ultimo;
}

/**
 * Perfil dos respondentes do Ciclo — % por perfil (Gestor/Secretário/etc),
 * consolidado entre todas as empresas/pesquisas do ciclo.
 */
async function buscarPerfilRespondentes(cicloId) {
  const { rows } = await query(
    `SELECT ri.valor_texto AS perfil, COUNT(*) AS qtd
     FROM respostas_itens ri
     JOIN pesquisa_perguntas pp ON pp.id = ri.pergunta_id
     JOIN pesquisa_blocos pb ON pb.id = pp.bloco_id
     JOIN respostas r ON r.id = ri.resposta_id
     JOIN pesquisas p ON p.id = r.pesquisa_id
     WHERE p.ciclo_id = $1 AND pb.tipo_bloco = 'identificacao' AND pp.tipo = 'multipla_escolha' AND r.concluida = true
     GROUP BY ri.valor_texto
     ORDER BY qtd DESC`,
    [cicloId]
  );
  const total = rows.reduce((acc, r) => acc + Number(r.qtd), 0);
  return rows.map((r) => ({ perfil: r.perfil, qtd: Number(r.qtd), percentual: total ? Math.round((Number(r.qtd) / total) * 100) : 0 }));
}

/**
 * Últimas respostas recebidas em todo o Ciclo (todas as empresas juntas),
 * mais recente primeiro.
 */
async function buscarUltimasRespostas(cicloId, limit = 10) {
  const { rows } = await query(
    `SELECT r.id, r.nome_completo, r.cargo, r.respondido_em, pc.nome_cliente, e.nome AS empresa_nome, sc.score_geral
     FROM respostas r
     JOIN pesquisa_clientes pc ON pc.id = r.pesquisa_cliente_id
     JOIN pesquisas p ON p.id = r.pesquisa_id
     JOIN empresas e ON e.id = p.empresa_id
     LEFT JOIN scores_calculados sc ON sc.resposta_id = r.id
     WHERE p.ciclo_id = $1 AND r.concluida = true
     ORDER BY r.respondido_em DESC
     LIMIT $2`,
    [cicloId, limit]
  );
  return rows;
}

/**
 * Histórico mensal de UM cliente específico (drill-down a partir do ranking).
 */
async function buscarHistoricoCliente(pesquisaClienteId) {
  const { rows } = await query(
    `SELECT ano_mes, isa, ise, ist, isv, score_geral, qtd_respostas
     FROM indicadores_mensais
     WHERE pesquisa_cliente_id = $1
     ORDER BY ano_mes ASC`,
    [pesquisaClienteId]
  );
  return rows;
}

/**
 * Endpoint consolidado do dashboard — busca tudo que a tela precisa numa
 * chamada só (KPIs vêm do último mês da própria evolução, sem query extra).
 */
async function buscarDashboardCiclo(cicloId) {
  const evolucao = await buscarEvolucaoCiclo(cicloId);
  const ultimoMes = evolucao[evolucao.length - 1] || null;

  const [distribuicaoSaude, perfilRespondentes, ultimasRespostas, ranking] = await Promise.all([
    buscarDistribuicaoSaude(cicloId, ultimoMes?.ano_mes),
    buscarPerfilRespondentes(cicloId),
    buscarUltimasRespostas(cicloId, 10),
    buscarRankingClientesCiclo(cicloId, ultimoMes?.ano_mes),
  ]);

  return {
    kpis: ultimoMes
      ? { anoMes: ultimoMes.ano_mes, isc: ultimoMes.isc, isa: ultimoMes.isa, ise: ultimoMes.ise, ist: ultimoMes.ist, isv: ultimoMes.isv }
      : null,
    evolucaoMensal: evolucao,
    distribuicaoSaude,
    perfilRespondentes,
    ultimasRespostas,
    ranking: ranking.ranking,
  };
}

module.exports = {
  calcularScoresResposta,
  atualizarIndicadorMensal,
  processarResposta,
  buscarEvolucaoCiclo,
  buscarRankingClientesCiclo,
  buscarDistribuicaoSaude,
  buscarPerfilRespondentes,
  buscarUltimasRespostas,
  buscarHistoricoCliente,
  buscarDashboardCiclo,
  faixaDeSaude,
};
