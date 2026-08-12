const pesquisaService = require('../services/pesquisa.service');
const calculoService = require('../services/calculo.service');

function tratarErro(err, res, next) {
  if (err instanceof pesquisaService.AppError) {
    return res.status(err.status).json({ erro: err.message });
  }
  return next(err);
}

async function postPesquisa(req, res, next) {
  try {
    const pesquisa = await pesquisaService.criarPesquisa(req.usuario, req.body);
    res.status(201).json({ pesquisa });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function getPesquisas(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const resultado = await pesquisaService.listarPesquisas(req.usuario, { page, limit });
    res.status(200).json(resultado);
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function getPesquisaDetalhe(req, res, next) {
  try {
    const pesquisa = await pesquisaService.buscarDetalhe(req.usuario, req.params.id);
    res.status(200).json({ pesquisa });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function putPesquisa(req, res, next) {
  try {
    const pesquisa = await pesquisaService.editarPesquisa(req.usuario, req.params.id, req.body);
    res.status(200).json({ pesquisa });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function postPergunta(req, res, next) {
  try {
    const pergunta = await pesquisaService.adicionarPergunta(req.usuario, req.params.id, req.params.blocoId, req.body);
    res.status(201).json({ pergunta });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function putPergunta(req, res, next) {
  try {
    const pergunta = await pesquisaService.editarPergunta(req.usuario, req.params.id, req.params.perguntaId, req.body);
    res.status(200).json({ pergunta });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function deletePergunta(req, res, next) {
  try {
    const resultado = await pesquisaService.removerPergunta(req.usuario, req.params.id, req.params.perguntaId);
    res.status(200).json(resultado);
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function postCliente(req, res, next) {
  try {
    const cliente = await pesquisaService.adicionarCliente(req.usuario, req.params.id, req.body.nomeCliente);
    res.status(201).json({ cliente });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function deleteCliente(req, res, next) {
  try {
    const resultado = await pesquisaService.removerCliente(req.usuario, req.params.id, req.params.clienteId);
    res.status(200).json(resultado);
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function postAtivar(req, res, next) {
  try {
    const pesquisa = await pesquisaService.ativarPesquisa(req.usuario, req.params.id);
    res.status(200).json({ pesquisa });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function postInativar(req, res, next) {
  try {
    const pesquisa = await pesquisaService.inativarPesquisa(req.usuario, req.params.id);
    res.status(200).json({ pesquisa });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function deletePesquisa(req, res, next) {
  try {
    const resultado = await pesquisaService.excluirPesquisa(req.usuario, req.params.id);
    res.status(200).json(resultado);
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function getQrCode(req, res, next) {
  try {
    const buffer = await pesquisaService.gerarQrCodePesquisa(req.usuario, req.params.id);
    res.setHeader('Content-Type', 'image/png');
    res.status(200).send(buffer);
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function getExportarRespondentes(req, res, next) {
  try {
    const { buffer } = await pesquisaService.exportarRespondentesUnicos(req.usuario);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="sigesc-leads-respondentes.xlsx"');
    res.status(200).send(buffer);
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function postDuplicar(req, res, next) {
  try {
    const pesquisa = await pesquisaService.duplicarPesquisa(req.usuario, req.params.id, req.body);
    res.status(201).json({ pesquisa });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function getEvolucaoCiclo(req, res, next) {
  try {
    const pesquisa = await pesquisaService.buscarDetalhe(req.usuario, req.params.id);
    const evolucao = await calculoService.buscarEvolucaoCiclo(pesquisa.ciclo_id);
    res.status(200).json({ cicloId: pesquisa.ciclo_id, cicloTitulo: pesquisa.ciclo.titulo, evolucao });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function getRankingCiclo(req, res, next) {
  try {
    const pesquisa = await pesquisaService.buscarDetalhe(req.usuario, req.params.id);
    const resultado = await calculoService.buscarRankingClientesCiclo(pesquisa.ciclo_id, req.query.anoMes);
    res.status(200).json({ cicloId: pesquisa.ciclo_id, cicloTitulo: pesquisa.ciclo.titulo, ...resultado });
  } catch (err) {
    tratarErro(err, res, next);
  }
}

module.exports = {
  postPesquisa,
  getPesquisas,
  getPesquisaDetalhe,
  putPesquisa,
  postPergunta,
  putPergunta,
  deletePergunta,
  postCliente,
  deleteCliente,
  postAtivar,
  postInativar,
  deletePesquisa,
  getQrCode,
  getExportarRespondentes,
  postDuplicar,
  getEvolucaoCiclo,
  getRankingCiclo,
};
