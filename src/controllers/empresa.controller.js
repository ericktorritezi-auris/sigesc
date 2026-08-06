const empresaService = require('../services/empresa.service');

async function getEmpresas(req, res, next) {
  try {
    const empresas = await empresaService.listarEmpresas(req.usuario);
    res.status(200).json({ empresas });
  } catch (err) {
    next(err);
  }
}

async function postEmpresa(req, res, next) {
  try {
    const empresa = await empresaService.criarEmpresa(req.usuario, req.body.nome);
    res.status(201).json({ empresa });
  } catch (err) {
    if (err instanceof empresaService.AppError) {
      return res.status(err.status).json({ erro: err.message });
    }
    next(err);
  }
}

module.exports = { getEmpresas, postEmpresa };
