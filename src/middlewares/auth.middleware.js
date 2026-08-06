const { verificarToken } = require('../utils/jwt');

/**
 * Exige um token JWT válido no header Authorization: Bearer <token>.
 * Se válido, popula req.usuario com o payload decodificado.
 */
function autenticar(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ erro: 'Token de autenticação não informado.' });
  }

  try {
    const payload = verificarToken(token);
    req.usuario = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

/**
 * Exige que o usuário autenticado tenha perfil "gestor".
 * Deve ser usado sempre depois de `autenticar`.
 */
function exigirGestor(req, res, next) {
  if (!req.usuario || req.usuario.perfil !== 'gestor') {
    return res.status(403).json({ erro: 'Acesso restrito a gestores.' });
  }
  return next();
}

module.exports = { autenticar, exigirGestor };
