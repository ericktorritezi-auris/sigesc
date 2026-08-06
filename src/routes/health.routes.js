const express = require('express');
const { checkConnection } = require('../config/db');

const router = express.Router();

router.get('/', async (req, res) => {
  const dbOk = await checkConnection();
  const status = dbOk ? 200 : 503;

  res.status(status).json({
    status: dbOk ? 'ok' : 'degraded',
    database: dbOk ? 'connected' : 'unreachable',
    versao: process.env.APP_VERSION || '1.0',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
