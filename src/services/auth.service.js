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
 *
 * O Administrador NUNCA é uma linha em `usuarios` — existe só como as
 * variáveis de ambiente ADMIN_EMAIL/ADMIN_PASSWORD. Por isso é a primeira
 * coisa verificada aqui: se bater, emite o token sem tocar no banco.
 * Isso garante, por construção, que o Administrador é imune a qualquer
 * reset do sistema — não há nada pra "preservar" durante a limpeza.
 */
async function login(email, senha) {
  if (!email || !senha) {
    throw new AuthError('E-mail e senha são obrigatórios.', 400);
  }

  const emailNormalizado = email.toLowerCase().trim();
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();

  if (adminEmail && emailNormalizado === adminEmail && senha === process.env.ADMIN_PASSWORD) {
    const token = gerarToken({ perfil: 'administrador' });
    return {
      token,
      usuario: { id: null, nome: 'Administrador SIGESC', email: adminEmail, perfil: 'administrador', organizacaoId: null, gestorId: null },
    };
  }

  const { rows } = await query(
    `SELECT id, organizacao_id, nome, email, senha_hash, perfil, gestor_id, ativo
     FROM usuarios WHERE email = $1`,
    [emailNormalizado]
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
