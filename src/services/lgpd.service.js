const { query } = require('../config/db');
const { gestorEfetivoId } = require('./empresa.service');

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function listarConsentimentos(usuarioAutenticado, { page = 1, limit = 20, clienteId, de, ate }) {
  const gestorId = gestorEfetivoId(usuarioAutenticado);
  const offset = (page - 1) * limit;

  const condicoes = ['p.gestor_id = $1'];
  const params = [gestorId];

  if (clienteId) { params.push(clienteId); condicoes.push(`c.pesquisa_cliente_id = $${params.length}`); }
  if (de) { params.push(de); condicoes.push(`c.respondido_em >= $${params.length}`); }
  if (ate) { params.push(ate); condicoes.push(`c.respondido_em <= $${params.length}`); }

  const whereClause = condicoes.join(' AND ');

  const { rows } = await query(
    `SELECT c.id, c.nome_completo, c.aceitou, c.respondido_em, c.ip_origem,
            p.titulo AS pesquisa_titulo, pc.nome_cliente
     FROM consentimentos_lgpd c
     JOIN pesquisas p ON p.id = c.pesquisa_id
     LEFT JOIN pesquisa_clientes pc ON pc.id = c.pesquisa_cliente_id
     WHERE ${whereClause}
     ORDER BY c.respondido_em DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const { rows: totalRows } = await query(
    `SELECT COUNT(*) FROM consentimentos_lgpd c JOIN pesquisas p ON p.id = c.pesquisa_id WHERE ${whereClause}`,
    params
  );
  const total = parseInt(totalRows[0].count, 10);

  return { consentimentos: rows, total, page, limit, totalPaginas: Math.ceil(total / limit) };
}

async function buscarDetalheConsentimento(usuarioAutenticado, consentimentoId) {
  const gestorId = gestorEfetivoId(usuarioAutenticado);

  const { rows } = await query(
    `SELECT c.*, p.titulo AS pesquisa_titulo, pc.nome_cliente
     FROM consentimentos_lgpd c
     JOIN pesquisas p ON p.id = c.pesquisa_id
     LEFT JOIN pesquisa_clientes pc ON pc.id = c.pesquisa_cliente_id
     WHERE c.id = $1 AND p.gestor_id = $2`,
    [consentimentoId, gestorId]
  );

  if (rows.length === 0) {
    throw new AppError('Registro de consentimento não encontrado.', 404);
  }
  return rows[0];
}

module.exports = { listarConsentimentos, buscarDetalheConsentimento, AppError };
