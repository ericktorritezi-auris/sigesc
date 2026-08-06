const respostaService = require('../services/resposta.service');
const { IAError } = require('../services/ia.service');

function tratarErro(err, res, next) {
  if (err instanceof respostaService.AppError || err instanceof IAError) {
    return res.status(err.status).json({ erro: err.message });
  }
  return next(err);
}

async function getRespostas(req, res, next) {
  try {
    const { page, limit, cicloId, pesquisaId, clienteId, de, ate } = req.query;
    const resultado = await respostaService.listarRespostas(req.usuario, {
      page: parseInt(page, 10) || 1,
      limit: Math.min(parseInt(limit, 10) || 20, 100),
      cicloId,
      pesquisaId,
      clienteId,
      de,
      ate,
    });
    res.status(200).json(resultado);
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function getRespostaDetalhe(req, res, next) {
  try {
    const resposta = await respostaService.buscarDetalheResposta(req.usuario, req.params.id);
    res.status(200).json({ resposta });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function postAnalisarSentimento(req, res, next) {
  try {
    const resultado = await respostaService.analisarSentimentoItem(req.usuario, req.params.id, req.params.perguntaId);
    res.status(200).json(resultado);
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function postPlanoAcao(req, res, next) {
  try {
    const resultado = await respostaService.gerarPlanoAcaoResposta(req.usuario, req.params.id);
    res.status(200).json(resultado);
  } catch (err) {
    tratarErro(err, res, next);
  }
}

module.exports = { getRespostas, getRespostaDetalhe, postAnalisarSentimento, postPlanoAcao };
