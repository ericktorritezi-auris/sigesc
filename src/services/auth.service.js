const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { gerarToken } = require('../utils/jwt');

class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

/**
 * Autentica um usuário por e-mail/senha.
 * Retorna { token, usuario } se sucesso, ou lança AuthError.
 */
async function login(email, senha) {
  if (!email || !senha) {
    throw new AuthError('E-mail e senha são obrigatórios.', 400);
  }

  const { rows } = await query(
    `SELECT id, organizacao_id, nome, email, senha_hash, perfil, gestor_id, ativo
     FROM usuarios WHERE email = $1`,
    [email.toLowerCase().trim()]
  );

  const usuario = rows[0];

  // Mensagem genérica propositalmente — não revelamos se o e-mail existe ou não.
  if (!usuario) {
    throw new AuthError('E-mail ou senha inválidos.');
  }

  if (!usuario.ativo) {
    throw new AuthError('Usuário inativo. Contate o gestor responsável.', 403);
  }

  const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
  if (!senhaCorreta) {
    throw new AuthError('E-mail ou senha inválidos.');
  }

  await query('UPDATE usuarios SET ultimo_login = now() WHERE id = $1', [usuario.id]);

  const token = gerarToken({
    id: usuario.id,
    organizacaoId: usuario.organizacao_id,
    perfil: usuario.perfil,
    gestorId: usuario.gestor_id,
  });

  return {
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      organizacaoId: usuario.organizacao_id,
      gestorId: usuario.gestor_id,
    },
  };
}

/**
 * Busca os dados públicos do usuário autenticado (rota /me).
 */
async function buscarUsuarioPorId(id) {
  const { rows } = await query(
    `SELECT id, organizacao_id, nome, email, perfil, gestor_id, ativo, ultimo_login
     FROM usuarios WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

module.exports = { login, buscarUsuarioPorId, AuthError };
