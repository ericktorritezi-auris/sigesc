const configuracaoService = require('../services/configuracao.service');

function tratarErro(err, res, next) {
  if (err instanceof configuracaoService.AppError) {
    return res.status(err.status).json({ erro: err.message });
  }
  return next(err);
}

async function getConfiguracao(req, res, next) {
  try {
    const configuracao = await configuracaoService.buscarConfiguracao(req.usuario);
    // iaDisponivel combina o toggle da organização com a existência real da
    // chave de API — é essa flag que o frontend deve usar pra decidir se
    // mostra os botões de IA, não só o toggle isolado.
    res.status(200).json({
      configuracao: { ...configuracao, iaDisponivel: Boolean(process.env.ANTHROPIC_API_KEY) && configuracao.ia_analise_habilitada },
    });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function putConfiguracao(req, res, next) {
  try {
    const configuracao = await configuracaoService.atualizarConfiguracao(req.usuario, req.body);
    res.status(200).json({ configuracao });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

module.exports = { getConfiguracao, putConfiguracao };
