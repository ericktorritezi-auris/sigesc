const relatorioService = require('../services/relatorio.service');
const { gerarPdfAnaliseCliente, gerarPdfAnaliseDimensao, gerarPdfAnaliseRespostas } = require('../services/pdf.service');
const { buscarConfiguracaoRodape } = require('../services/configuracao-sistema.service');

const DIMENSOES_INFO = {
  isa: { label: 'Atendimento', sigla: 'ISA' },
  ise: { label: 'Infraestrutura', sigla: 'ISE' },
  ist: { label: 'Tecnologia', sigla: 'IST' },
  isv: { label: 'Valor Percebido', sigla: 'ISV' },
};

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

async function getPdfCliente(req, res, next) {
  try {
    const dados = await relatorioService.buscarRelatorioCliente(req.usuario, req.params.clienteId);
    const configRodape = await buscarConfiguracaoRodape();
    const buffer = await gerarPdfAnaliseCliente({ ...dados, versao: process.env.APP_VERSION || '1.2', configRodape });
    const nomeArquivo = `analise-${dados.cliente.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    res.status(200).send(buffer);
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function getPdfDimensao(req, res, next) {
  try {
    const dados = await relatorioService.buscarRelatorioDimensao(req.usuario, req.params.dimensao);
    const info = DIMENSOES_INFO[req.params.dimensao];
    if (!info) return res.status(400).json({ erro: 'Dimensão inválida.' });
    const configRodape = await buscarConfiguracaoRodape();
    const buffer = await gerarPdfAnaliseDimensao({ ...dados, ...info, versao: process.env.APP_VERSION || '1.2', configRodape });
    const nomeArquivo = `analise-dimensao-${req.params.dimensao}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    res.status(200).send(buffer);
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function getAnaliseRespostas(req, res, next) {
  try {
    const analise = await relatorioService.buscarAnaliseRespostas(req.usuario);
    res.status(200).json(analise);
  } catch (err) {
    tratarErro(err, res, next);
  }
}

async function getPdfRespostas(req, res, next) {
  try {
    const dados = await relatorioService.buscarAnaliseRespostas(req.usuario);
    const configRodape = await buscarConfiguracaoRodape();
    const buffer = await gerarPdfAnaliseRespostas({ ...dados, versao: process.env.APP_VERSION || '1.2', configRodape });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="analise-respostas.pdf"`);
    res.status(200).send(buffer);
  } catch (err) {
    tratarErro(err, res, next);
  }
}

module.exports = { getClientes, getRelatorioCliente, getRelatorioDimensao, getPdfCliente, getPdfDimensao, getAnaliseRespostas, getPdfRespostas };
