const usuarioService = require('../services/usuario.service');

function tratarErro(err, res, next) {
  if (err instanceof usuarioService.AppError) {
    return res.status(err.status).json({ erro: err.message });
  }
  return next(err);
}

async function getUsuarios(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const resultado = await usuarioService.listarUsuarios(req.usuario, { page, limit });
    res.status(200).json(resultado);
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function postUsuario(req, res, next) {
  try {
    const usuario = await usuarioService.criarUsuario(req.usuario, req.body);
    res.status(201).json({ usuario });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function putUsuario(req, res, next) {
  try {
    const usuario = await usuarioService.editarUsuario(req.usuario, req.params.id, req.body);
    res.status(200).json({ usuario });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

module.exports = { getUsuarios, postUsuario, putUsuario };
