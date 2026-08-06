const { query } = require('../config/db');
const { gestorEfetivoId } = require('./empresa.service');
const calculoService = require('./calculo.service');

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function carregarCicloOuFalhar(usuarioAutenticado, cicloId) {
  const gestorId = gestorEfetivoId(usuarioAutenticado);
  const { rows } = await query('SELECT * FROM ciclos_pesquisa WHERE id = $1 AND gestor_id = $2', [cicloId, gestorId]);
  if (rows.length === 0) {
    throw new AppError('Ciclo não encontrado.', 404);
  }
  return rows[0];
}

async function listarCiclos(usuarioAutenticado) {
  const gestorId = gestorEfetivoId(usuarioAutenticado);
  const { rows } = await query(
    `SELECT c.id, c.titulo, c.created_at,
            (SELECT COUNT(*) FROM pesquisas p WHERE p.ciclo_id = c.id) AS total_pesquisas,
            (SELECT COUNT(DISTINCT pc.id) FROM pesquisa_clientes pc JOIN pesquisas p2 ON p2.id = pc.pesquisa_id WHERE p2.ciclo_id = c.id) AS total_clientes
     FROM ciclos_pesquisa c
     WHERE c.gestor_id = $1
     ORDER BY c.created_at DESC`,
    [gestorId]
  );
  return rows;
}

async function buscarDashboard(usuarioAutenticado, cicloId) {
  const ciclo = await carregarCicloOuFalhar(usuarioAutenticado, cicloId);
  const dados = await calculoService.buscarDashboardCiclo(cicloId);
  return { ciclo: { id: ciclo.id, titulo: ciclo.titulo }, ...dados };
}

async function buscarHistoricoCliente(usuarioAutenticado, cicloId, pesquisaClienteId) {
  await carregarCicloOuFalhar(usuarioAutenticado, cicloId);

  const { rows } = await query(
    `SELECT pc.nome_cliente, e.nome AS empresa_nome FROM pesquisa_clientes pc
     JOIN pesquisas p ON p.id = pc.pesquisa_id
     JOIN empresas e ON e.id = p.empresa_id
     WHERE pc.id = $1 AND p.ciclo_id = $2`,
    [pesquisaClienteId, cicloId]
  );
  if (rows.length === 0) {
    throw new AppError('Cliente não encontrado neste ciclo.', 404);
  }

  const historico = await calculoService.buscarHistoricoCliente(pesquisaClienteId);
  return { cliente: rows[0], historico };
}

module.exports = { listarCiclos, buscarDashboard, buscarHistoricoCliente, AppError };
