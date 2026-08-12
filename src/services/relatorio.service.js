const { query } = require('../config/db');
const { gestorEfetivoId } = require('./empresa.service');
const { buscarHistoricoCliente } = require('./calculo.service');

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const DIMENSOES_VALIDAS = ['isa', 'ise', 'ist', 'isv'];

/**
 * Lista TODOS os clientes de TODAS as empresas/pesquisas do gestor — não
 * filtrado por empresa nem por ciclo, conforme pedido explicitamente por
 * Erick ("independente da empresa, cliente que respondeu a pesquisa").
 */
async function listarClientesParaRelatorio(usuarioAutenticado) {
  const gestorId = gestorEfetivoId(usuarioAutenticado);
  const { rows } = await query(
    `SELECT DISTINCT pc.id, pc.nome_cliente, e.nome AS empresa_nome
     FROM pesquisa_clientes pc
     JOIN pesquisas p ON p.id = pc.pesquisa_id
     JOIN empresas e ON e.id = p.empresa_id
     WHERE p.gestor_id = $1
     ORDER BY pc.nome_cliente ASC`,
    [gestorId]
  );
  return rows;
}

/**
 * Média mais recente de cada cliente do gestor — usada tanto pra comparação
 * no relatório de cliente individual quanto pra ranking por dimensão.
 */
async function buscarUltimoIndicadorPorCliente(gestorId) {
  const { rows } = await query(
    `SELECT DISTINCT ON (im.pesquisa_cliente_id)
            im.pesquisa_cliente_id, im.ano_mes, im.isa, im.ise, im.ist, im.isv, im.score_geral,
            pc.nome_cliente, e.nome AS empresa_nome
     FROM indicadores_mensais im
     JOIN pesquisa_clientes pc ON pc.id = im.pesquisa_cliente_id
     JOIN pesquisas p ON p.id = pc.pesquisa_id
     JOIN empresas e ON e.id = p.empresa_id
     WHERE p.gestor_id = $1
     ORDER BY im.pesquisa_cliente_id, im.ano_mes DESC`,
    [gestorId]
  );
  return rows;
}

/**
 * Relatório de UM cliente específico — KPIs mais recentes, histórico mensal
 * completo (reaproveita o motor de cálculo, não recalcula nada) e comparação
 * com a média geral da carteira inteira do gestor.
 */
async function buscarRelatorioCliente(usuarioAutenticado, pesquisaClienteId) {
  const gestorId = gestorEfetivoId(usuarioAutenticado);

  const { rows: clienteRows } = await query(
    `SELECT pc.id, pc.nome_cliente, e.nome AS empresa_nome
     FROM pesquisa_clientes pc
     JOIN pesquisas p ON p.id = pc.pesquisa_id
     JOIN empresas e ON e.id = p.empresa_id
     WHERE pc.id = $1 AND p.gestor_id = $2`,
    [pesquisaClienteId, gestorId]
  );
  if (clienteRows.length === 0) {
    throw new AppError('Cliente não encontrado na sua conta.', 404);
  }
  const cliente = clienteRows[0];

  const historico = await buscarHistoricoCliente(pesquisaClienteId);
  const ultimoMes = historico[historico.length - 1] || null;

  const { rows: respostasRows } = await query(
    `SELECT COUNT(*) AS total, MAX(respondido_em) AS ultima
     FROM respostas WHERE pesquisa_cliente_id = $1 AND concluida = true`,
    [pesquisaClienteId]
  );

  const todosClientes = await buscarUltimoIndicadorPorCliente(gestorId);
  const mediaCarteira = todosClientes.length
    ? todosClientes.reduce((acc, c) => acc + Number(c.score_geral), 0) / todosClientes.length
    : null;

  return {
    cliente: { id: cliente.id, nome: cliente.nome_cliente, empresa: cliente.empresa_nome },
    kpis: ultimoMes,
    historico,
    totalRespostas: parseInt(respostasRows[0].total, 10),
    ultimaResposta: respostasRows[0].ultima,
    mediaCarteira: mediaCarteira !== null ? Number(mediaCarteira.toFixed(2)) : null,
  };
}

/**
 * Relatório de UMA dimensão específica (ISA/ISE/IST/ISV) — média geral,
 * ranking completo (todos os clientes do gestor, todas as empresas) e
 * evolução mensal da média geral daquela dimensão ao longo do tempo.
 */
async function buscarRelatorioDimensao(usuarioAutenticado, dimensao) {
  if (!DIMENSOES_VALIDAS.includes(dimensao)) {
    throw new AppError('Dimensão inválida. Use isa, ise, ist ou isv.');
  }
  const gestorId = gestorEfetivoId(usuarioAutenticado);

  const todosClientes = await buscarUltimoIndicadorPorCliente(gestorId);
  const ranking = todosClientes
    .map((c) => ({ nomeCliente: c.nome_cliente, empresaNome: c.empresa_nome, valor: Number(c[dimensao]) }))
    .sort((a, b) => b.valor - a.valor);

  const media = ranking.length ? ranking.reduce((acc, c) => acc + c.valor, 0) / ranking.length : null;

  const { rows: evolucao } = await query(
    `SELECT im.ano_mes, AVG(im.${dimensao})::numeric(4,2) AS media
     FROM indicadores_mensais im
     JOIN pesquisa_clientes pc ON pc.id = im.pesquisa_cliente_id
     JOIN pesquisas p ON p.id = pc.pesquisa_id
     WHERE p.gestor_id = $1
     GROUP BY im.ano_mes
     ORDER BY im.ano_mes ASC`,
    [gestorId]
  );

  return {
    dimensao,
    media: media !== null ? Number(media.toFixed(2)) : null,
    ranking,
    evolucaoMensal: evolucao,
  };
}

const METRICAS_RESPOSTA_VALIDAS = ['score_geral', 'isv'];

/**
 * Análise por Respostas — visão nova (07/08/2026, pedido de Erick): olha
 * pra RESPOSTA INDIVIDUAL, não pro cliente agregado. Junta tudo que a tela
 * precisa numa chamada só (mesmo padrão do dashboard de Ciclo).
 */
async function buscarAnaliseRespostas(usuarioAutenticado) {
  const gestorId = gestorEfetivoId(usuarioAutenticado);

  const [volumePorCliente, topScoreMaiores, topScoreMenores, topIsvMaiores, topIsvMenores, sentimento, volumeXValor] = await Promise.all([
    buscarVolumeRespostasPorCliente(gestorId),
    buscarTopRespostas(gestorId, 'score_geral', 'DESC'),
    buscarTopRespostas(gestorId, 'score_geral', 'ASC'),
    buscarTopRespostas(gestorId, 'isv', 'DESC'),
    buscarTopRespostas(gestorId, 'isv', 'ASC'),
    buscarSentimentoConsolidado(gestorId),
    buscarVolumeXValor(gestorId),
  ]);

  return { volumePorCliente, topScoreMaiores, topScoreMenores, topIsvMaiores, topIsvMenores, sentimento, volumeXValor };
}

async function buscarVolumeRespostasPorCliente(gestorId) {
  const { rows } = await query(
    `SELECT pc.nome_cliente, e.nome AS empresa_nome, COUNT(r.id) AS total
     FROM pesquisa_clientes pc
     JOIN pesquisas p ON p.id = pc.pesquisa_id
     JOIN empresas e ON e.id = p.empresa_id
     JOIN respostas r ON r.pesquisa_cliente_id = pc.id AND r.concluida = true
     WHERE p.gestor_id = $1
     GROUP BY pc.id, pc.nome_cliente, e.nome
     ORDER BY total DESC`,
    [gestorId]
  );
  return rows.map((r) => ({ nomeCliente: r.nome_cliente, empresaNome: r.empresa_nome, total: parseInt(r.total, 10) }));
}

/** Top 5 respostas INDIVIDUAIS (não agregadas por cliente) por uma métrica específica. */
async function buscarTopRespostas(gestorId, metrica, direcao) {
  if (!METRICAS_RESPOSTA_VALIDAS.includes(metrica)) {
    throw new AppError('Métrica inválida. Use score_geral ou isv.');
  }
  const direcaoSql = direcao === 'ASC' ? 'ASC' : 'DESC';

  const { rows } = await query(
    `SELECT r.nome_completo, r.cargo, pc.nome_cliente, e.nome AS empresa_nome, sc.${metrica} AS valor
     FROM respostas r
     JOIN scores_calculados sc ON sc.resposta_id = r.id
     JOIN pesquisa_clientes pc ON pc.id = r.pesquisa_cliente_id
     JOIN pesquisas p ON p.id = r.pesquisa_id
     JOIN empresas e ON e.id = p.empresa_id
     WHERE p.gestor_id = $1 AND r.concluida = true AND sc.${metrica} IS NOT NULL
     ORDER BY sc.${metrica} ${direcaoSql}
     LIMIT 5`,
    [gestorId]
  );
  return rows.map((r) => ({
    nomeCompleto: r.nome_completo,
    cargo: r.cargo,
    nomeCliente: r.nome_cliente,
    empresaNome: r.empresa_nome,
    valor: Number(r.valor),
  }));
}

/** Consolidado de sentimento de IA — só conta o que já foi analisado (sentimento_ia preenchido). */
async function buscarSentimentoConsolidado(gestorId) {
  const { rows } = await query(
    `SELECT ri.sentimento_ia, COUNT(*) AS total
     FROM respostas_itens ri
     JOIN respostas r ON r.id = ri.resposta_id
     JOIN pesquisas p ON p.id = r.pesquisa_id
     WHERE p.gestor_id = $1 AND ri.sentimento_ia IS NOT NULL
     GROUP BY ri.sentimento_ia`,
    [gestorId]
  );
  const consolidado = { positivo: 0, neutro: 0, negativo: 0 };
  let total = 0;
  rows.forEach((r) => {
    if (consolidado[r.sentimento_ia] !== undefined) {
      consolidado[r.sentimento_ia] = parseInt(r.total, 10);
      total += parseInt(r.total, 10);
    }
  });
  return { total, consolidado };
}

/** Volume de respostas x score médio, por cliente — pra visualizar correlação. */
async function buscarVolumeXValor(gestorId) {
  const { rows } = await query(
    `SELECT pc.nome_cliente, COUNT(r.id) AS total, AVG(sc.score_geral)::numeric(4,2) AS media
     FROM pesquisa_clientes pc
     JOIN pesquisas p ON p.id = pc.pesquisa_id
     JOIN respostas r ON r.pesquisa_cliente_id = pc.id AND r.concluida = true
     JOIN scores_calculados sc ON sc.resposta_id = r.id
     WHERE p.gestor_id = $1
     GROUP BY pc.id, pc.nome_cliente
     ORDER BY total DESC`,
    [gestorId]
  );
  return rows.map((r) => ({ nomeCliente: r.nome_cliente, total: parseInt(r.total, 10), media: Number(r.media) }));
}

module.exports = {
  listarClientesParaRelatorio,
  buscarRelatorioCliente,
  buscarRelatorioDimensao,
  buscarAnaliseRespostas,
  AppError,
};
