const authService = require('../services/auth.service');

async function postLogin(req, res, next) {
  try {
    const { email, senha } = req.body;
    const resultado = await authService.login(email, senha);
    return res.status(200).json(resultado);
  } catch (err) {
    if (err instanceof authService.AuthError) {
      return res.status(err.status).json({ erro: err.message });
    }
    return next(err);
  }
}

async function getMe(req, res, next) {
  try {
    // Administrador não é uma linha em `usuarios` — seus dados vêm direto do token.
    if (req.usuario.perfil === 'administrador') {
      return res.status(200).json({
        usuario: { id: null, nome: 'Administrador SIGESC', email: process.env.ADMIN_EMAIL, perfil: 'administrador' },
      });
    }

    const usuario = await authService.buscarUsuarioPorId(req.usuario.id);
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }
    return res.status(200).json({ usuario });
  } catch (err) {
    return next(err);
  }
}

module.exports = { postLogin, getMe };
