// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[SIGESC][ERROR]', err);

  if (res.headersSent) {
    return next(err);
  }

  // Corpo da requisição não é um JSON válido — não expõe detalhes do parser ao cliente.
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ erro: 'Corpo da requisição não é um JSON válido.' });
  }

  const status = err.status || 500;
  const mensagem = status === 500 ? 'Erro interno do servidor.' : err.message;

  res.status(status).json({ erro: mensagem });
}

function notFoundHandler(req, res) {
  res.status(404).json({ erro: 'Rota não encontrada.' });
}

module.exports = { errorHandler, notFoundHandler };
