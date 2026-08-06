const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

if (!SECRET) {
  console.error('[SIGESC] ERRO FATAL: variável JWT_SECRET não configurada.');
  process.exit(1);
}

/**
 * Gera um token JWT para o usuário autenticado.
 * @param {Object} payload - { id, perfil, gestorId, organizacaoId }
 */
function gerarToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

/**
 * Verifica e decodifica um token JWT. Lança erro se inválido/expirado.
 */
function verificarToken(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { gerarToken, verificarToken };
