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

/**
 * Exige que o usuário autenticado seja o Administrador (baseado em
 * variável de ambiente — nunca uma linha em `usuarios`).
 */
function exigirAdministrador(req, res, next) {
  if (!req.usuario || req.usuario.perfil !== 'administrador') {
    return res.status(403).json({ erro: 'Acesso restrito ao Administrador.' });
  }
  return next();
}

/**
 * Bloqueia explicitamente o Administrador das rotas de negócio do Gestor
 * (Pesquisas, Empresas, Ciclos, etc). O Administrador só orquestra Gestores —
 * nunca deve conseguir ler/tocar dados de nenhuma carteira específica.
 */
function bloquearAdministrador(req, res, next) {
  if (req.usuario && req.usuario.perfil === 'administrador') {
    return res.status(403).json({ erro: 'Administrador não tem acesso a esta área — use o Painel do Administrador.' });
  }
  return next();
}

module.exports = { autenticar, exigirGestor, exigirAdministrador, bloquearAdministrador };
