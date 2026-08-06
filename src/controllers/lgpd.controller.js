const lgpdService = require('../services/lgpd.service');

function tratarErro(err, res, next) {
  if (err instanceof lgpdService.AppError) {
    return res.status(err.status).json({ erro: err.message });
  }
  return next(err);
}

async function getConsentimentos(req, res, next) {
  try {
    const { page, limit, clienteId, de, ate } = req.query;
    const resultado = await lgpdService.listarConsentimentos(req.usuario, {
      page: parseInt(page, 10) || 1,
      limit: Math.min(parseInt(limit, 10) || 20, 100),
      clienteId,
      de,
      ate,
    });
    res.status(200).json(resultado);
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function getConsentimentoDetalhe(req, res, next) {
  try {
    const consentimento = await lgpdService.buscarDetalheConsentimento(req.usuario, req.params.id);
    res.status(200).json({ consentimento });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

module.exports = { getConsentimentos, getConsentimentoDetalhe };
