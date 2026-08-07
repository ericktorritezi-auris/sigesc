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

module.exports = { listarClientesParaRelatorio, buscarRelatorioCliente, buscarRelatorioDimensao, AppError };
