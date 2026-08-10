const express = require('express');
const { checkConnection } = require('../config/db');
const { buscarConfiguracaoRodape } = require('../services/configuracao-sistema.service');

const router = express.Router();

router.get('/', async (req, res) => {
  const dbOk = await checkConnection();
  const status = dbOk ? 200 : 503;

  let rodape = { rodapeHabilitado: true, rodapeTexto: '' };
  try {
    rodape = await buscarConfiguracaoRodape();
  } catch (err) { /* se essa consulta falhar por qualquer motivo, cai no padrão (rodapé oficial ligado) — nunca quebra o health check por causa disso */ }

  res.status(status).json({
    status: dbOk ? 'ok' : 'degraded',
    database: dbOk ? 'connected' : 'unreachable',
    versao: process.env.APP_VERSION || '1.0',
    rodapeHabilitado: rodape.rodapeHabilitado,
    rodapeTexto: rodape.rodapeTexto,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
