const publicoService = require('../services/publico.service');
const { verificarRecaptcha } = require('../services/recaptcha.service');

function tratarErro(err, res, next) {
  if (err instanceof publicoService.AppError) {
    return res.status(err.status).json({ erro: err.message });
  }
  return next(err);
}

function obterIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'desconhecido';
}

async function getConfig(req, res) {
  res.status(200).json({
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || null,
    recaptchaHabilitado: Boolean(process.env.RECAPTCHA_SECRET_KEY),
  });
}

async function getPesquisaPublica(req, res, next) {
  try {
    const dados = await publicoService.buscarPesquisaPublica(req.params.slug);
    res.status(200).json({ pesquisa: dados });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function postRecusa(req, res, next) {
  try {
    // Recusa não exige reCAPTCHA — é uma ação de baixo risco de abuso
    // (não insere dados de pesquisa, só registra o evento de não-consentimento).
    const resultado = await publicoService.registrarRecusa(req.params.slug, obterIp(req));
    res.status(201).json(resultado);
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function postResposta(req, res, next) {
  try {
    const recaptcha = await verificarRecaptcha(req.body.recaptchaToken);
    if (!recaptcha.sucesso) {
      return res.status(400).json({ erro: 'Falha na verificação de segurança (reCAPTCHA). Tente novamente.' });
    }
    const resultado = await publicoService.registrarResposta(req.params.slug, req.body, obterIp(req));
    res.status(201).json(resultado);
  } catch (err) {
    tratarErro(err, res, next);
  }
}

module.exports = { getConfig, getPesquisaPublica, postRecusa, postResposta };
