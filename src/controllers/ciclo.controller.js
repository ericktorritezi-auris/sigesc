const cicloService = require('../services/ciclo.service');

function tratarErro(err, res, next) {
  if (err instanceof cicloService.AppError) {
    return res.status(err.status).json({ erro: err.message });
  }
  return next(err);
}

async function getCiclos(req, res, next) {
  try {
    const ciclos = await cicloService.listarCiclos(req.usuario);
    res.status(200).json({ ciclos });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function getDashboard(req, res, next) {
  try {
    const dashboard = await cicloService.buscarDashboard(req.usuario, req.params.id);
    res.status(200).json(dashboard);
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function getHistoricoCliente(req, res, next) {
  try {
    const historico = await cicloService.buscarHistoricoCliente(req.usuario, req.params.id, req.params.clienteId);
    res.status(200).json(historico);
  } catch (err) {
    tratarErro(err, res, next);
  }
}

module.exports = { getCiclos, getDashboard, getHistoricoCliente };
