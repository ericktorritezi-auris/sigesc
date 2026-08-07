const relatorioService = require('../services/relatorio.service');

function tratarErro(err, res, next) {
  if (err instanceof relatorioService.AppError) {
    return res.status(err.status).json({ erro: err.message });
  }
  return next(err);
}

async function getClientes(req, res, next) {
  try {
    const clientes = await relatorioService.listarClientesParaRelatorio(req.usuario);
    res.status(200).json({ clientes });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function getRelatorioCliente(req, res, next) {
  try {
    const relatorio = await relatorioService.buscarRelatorioCliente(req.usuario, req.params.clienteId);
    res.status(200).json(relatorio);
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function getRelatorioDimensao(req, res, next) {
  try {
    const relatorio = await relatorioService.buscarRelatorioDimensao(req.usuario, req.params.dimensao);
    res.status(200).json(relatorio);
  } catch (err) {
    tratarErro(err, res, next);
  }
}

module.exports = { getClientes, getRelatorioCliente, getRelatorioDimensao };
