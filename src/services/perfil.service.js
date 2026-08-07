const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Dados do próprio usuário autenticado — Gestor ou Usuário vinculado.
 * Administrador não usa isso (não é uma linha no banco, não tem senha
 * pra ver/trocar aqui — segue existindo só como variável de ambiente).
 */
async function buscarPerfil(usuarioAutenticado) {
  const { rows } = await query(
    `SELECT u.id, u.nome, u.email, u.perfil, u.created_at, o.nome AS organizacao_nome,
            g.nome AS gestor_nome
     FROM usuarios u
     JOIN organizacoes o ON o.id = u.organizacao_id
     LEFT JOIN usuarios g ON g.id = u.gestor_id
     WHERE u.id = $1`,
    [usuarioAutenticado.id]
  );
  if (rows.length === 0) {
    throw new AppError('Usuário não encontrado.', 404);
  }
  return rows[0];
}

/**
 * Troca a própria senha — exige a senha atual (evita que qualquer um com a
 * sessão aberta troque a senha sem realmente saber a atual). É assim que um
 * Usuário criado pelo Gestor com senha padrão troca pra uma senha só dele.
 */
async function alterarSenha(usuarioAutenticado, senhaAtual, novaSenha) {
  if (!senhaAtual || !novaSenha) {
    throw new AppError('Informe a senha atual e a nova senha.');
  }
  if (novaSenha.length < 8) {
    throw new AppError('A nova senha precisa ter ao menos 8 caracteres.');
  }

  const { rows } = await query('SELECT senha_hash FROM usuarios WHERE id = $1', [usuarioAutenticado.id]);
  if (rows.length === 0) {
    throw new AppError('Usuário não encontrado.', 404);
  }

  const confere = await bcrypt.compare(senhaAtual, rows[0].senha_hash);
  if (!confere) {
    throw new AppError('Senha atual incorreta.', 401);
  }

  const novoHash = await bcrypt.hash(novaSenha, parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10));
  await query('UPDATE usuarios SET senha_hash = $1, updated_at = now() WHERE id = $2', [novoHash, usuarioAutenticado.id]);

  return { alterada: true };
}

module.exports = { buscarPerfil, alterarSenha, AppError };
