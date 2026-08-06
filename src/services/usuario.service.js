const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { gestorEfetivoId } = require('./empresa.service');

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function listarUsuarios(usuarioAutenticado, { page = 1, limit = 20 }) {
  const gestorId = gestorEfetivoId(usuarioAutenticado);
  const offset = (page - 1) * limit;

  const { rows } = await query(
    `SELECT id, nome, email, ativo, ultimo_login, created_at
     FROM usuarios WHERE perfil = 'usuario' AND gestor_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [gestorId, limit, offset]
  );
  const { rows: totalRows } = await query(`SELECT COUNT(*) FROM usuarios WHERE perfil = 'usuario' AND gestor_id = $1`, [gestorId]);
  const total = parseInt(totalRows[0].count, 10);

  return { usuarios: rows, total, page, limit, totalPaginas: Math.ceil(total / limit) };
}

async function criarUsuario(usuarioAutenticado, { nome, email, senha }) {
  // Só o Gestor cria usuários vinculados a ele — reforçado também na rota.
  if (usuarioAutenticado.perfil !== 'gestor') {
    throw new AppError('Apenas o gestor pode cadastrar novos usuários.', 403);
  }

  if (!nome || !nome.trim()) throw new AppError('Nome é obrigatório.');
  if (!email || !email.trim()) throw new AppError('E-mail é obrigatório.');
  if (!senha || senha.length < 8) throw new AppError('Senha precisa ter ao menos 8 caracteres.');

  const emailNormalizado = email.toLowerCase().trim();
  const existente = await query('SELECT id FROM usuarios WHERE email = $1', [emailNormalizado]);
  if (existente.rows.length > 0) {
    throw new AppError('Já existe um usuário com este e-mail.', 409);
  }

  const senhaHash = await bcrypt.hash(senha, parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10));

  const { rows } = await query(
    `INSERT INTO usuarios (organizacao_id, gestor_id, nome, email, senha_hash, perfil, ativo)
     VALUES ($1, $2, $3, $4, $5, 'usuario', true)
     RETURNING id, nome, email, ativo, created_at`,
    [usuarioAutenticado.organizacaoId, usuarioAutenticado.id, nome.trim(), emailNormalizado, senhaHash]
  );
  return rows[0];
}

async function editarUsuario(usuarioAutenticado, usuarioId, { nome, ativo }) {
  if (usuarioAutenticado.perfil !== 'gestor') {
    throw new AppError('Apenas o gestor pode editar usuários.', 403);
  }

  const existente = await query(`SELECT id FROM usuarios WHERE id = $1 AND gestor_id = $2 AND perfil = 'usuario'`, [
    usuarioId,
    usuarioAutenticado.id,
  ]);
  if (existente.rows.length === 0) {
    throw new AppError('Usuário não encontrado na sua conta.', 404);
  }

  const { rows } = await query(
    `UPDATE usuarios SET nome = COALESCE($1, nome), ativo = COALESCE($2, ativo), updated_at = now()
     WHERE id = $3
     RETURNING id, nome, email, ativo`,
    [nome || null, ativo, usuarioId]
  );
  return rows[0];
}

module.exports = { listarUsuarios, criarUsuario, editarUsuario, AppError };
