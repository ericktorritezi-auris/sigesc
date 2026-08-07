const perfilService = require('../services/perfil.service');

function tratarErro(err, res, next) {
  if (err instanceof perfilService.AppError) {
    return res.status(err.status).json({ erro: err.message });
  }
  return next(err);
}

async function getPerfil(req, res, next) {
  try {
    const perfil = await perfilService.buscarPerfil(req.usuario);
    res.status(200).json({ perfil });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function putSenha(req, res, next) {
  try {
    const resultado = await perfilService.alterarSenha(req.usuario, req.body.senhaAtual, req.body.novaSenha);
    res.status(200).json(resultado);
  } catch (err) {
    tratarErro(err, res, next);
  }
}

module.exports = { getPerfil, putSenha };
