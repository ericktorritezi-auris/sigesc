const { query } = require('../config/db');

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Resolve o "gestor efetivo" de uma requisição autenticada: se for o próprio
 * gestor, é o id dele; se for um usuário vinculado, é o gestorId do token.
 * Centralizado aqui porque Empresas, Pesquisas e Ciclos usam a mesma regra.
 */
function gestorEfetivoId(usuarioAutenticado) {
  return usuarioAutenticado.perfil === 'gestor' ? usuarioAutenticado.id : usuarioAutenticado.gestorId;
}

async function listarEmpresas(usuarioAutenticado) {
  const gestorId = gestorEfetivoId(usuarioAutenticado);
  const { rows } = await query(
    `SELECT id, nome, ativa, created_at FROM empresas WHERE gestor_id = $1 AND ativa = true ORDER BY nome ASC`,
    [gestorId]
  );
  return rows;
}

async function criarEmpresa(usuarioAutenticado, nome) {
  const gestorId = gestorEfetivoId(usuarioAutenticado);
  const nomeLimpo = (nome || '').trim();

  if (!nomeLimpo) {
    throw new AppError('Nome da empresa é obrigatório.');
  }

  const existente = await query('SELECT id FROM empresas WHERE gestor_id = $1 AND nome = $2', [gestorId, nomeLimpo]);
  if (existente.rows.length > 0) {
    throw new AppError('Já existe uma empresa com este nome na sua conta.', 409);
  }

  const { rows } = await query(
    `INSERT INTO empresas (gestor_id, nome) VALUES ($1, $2) RETURNING id, nome, ativa, created_at`,
    [gestorId, nomeLimpo]
  );
  return rows[0];
}

module.exports = { listarEmpresas, criarEmpresa, gestorEfetivoId, AppError };
