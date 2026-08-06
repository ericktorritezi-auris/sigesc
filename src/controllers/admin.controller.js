const adminService = require('../services/admin.service');

function tratarErro(err, res, next) {
  if (err instanceof adminService.AppError) {
    return res.status(err.status).json({ erro: err.message });
  }
  return next(err);
}

async function getGestores(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const resultado = await adminService.listarGestores({ page, limit });
    res.status(200).json(resultado);
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function postGestor(req, res, next) {
  try {
    const gestor = await adminService.criarGestor(req.body);
    res.status(201).json({ gestor });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function putGestor(req, res, next) {
  try {
    const gestor = await adminService.editarGestor(req.params.id, req.body);
    res.status(200).json({ gestor });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function getBackup(req, res, next) {
  try {
    const backup = await adminService.exportarBackupCompleto();
    res.setHeader('Content-Disposition', `attachment; filename="sigesc-backup-${Date.now()}.json"`);
    res.status(200).json(backup);
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function postReset(req, res, next) {
  try {
    const resultado = await adminService.resetarSistema(req.body.confirmacao);
    res.status(200).json(resultado);
  } catch (err) {
    tratarErro(err, res, next);
  }
}

module.exports = { getGestores, postGestor, putGestor, getBackup, postReset };
