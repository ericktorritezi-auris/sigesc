const empresaService = require('../services/empresa.service');

function tratarErro(err, res, next) {
  if (err instanceof empresaService.AppError) {
    return res.status(err.status).json({ erro: err.message });
  }
  return next(err);
}

async function getEmpresas(req, res, next) {
  try {
    const empresas = await empresaService.listarEmpresas(req.usuario);
    res.status(200).json({ empresas });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function getEmpresaDetalhe(req, res, next) {
  try {
    const empresa = await empresaService.buscarEmpresa(req.usuario, req.params.id);
    res.status(200).json({ empresa });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function putEmpresa(req, res, next) {
  try {
    const empresa = await empresaService.editarEmpresa(req.usuario, req.params.id, req.body);
    res.status(200).json({ empresa });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function postEmpresa(req, res, next) {
  try {
    const empresa = await empresaService.criarEmpresa(req.usuario, req.body.nome);
    res.status(201).json({ empresa });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

module.exports = { getEmpresas, getEmpresaDetalhe, putEmpresa, postEmpresa };
