const express = require('express');
const rateLimit = require('express-rate-limit');
const publicoController = require('../controllers/publico.controller');

const router = express.Router();

// Protege as rotas públicas contra abuso/spam — nenhum login exigido aqui,
// então o rate limit é a principal barreira além do reCAPTCHA.
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  message: { erro: 'Muitas requisições. Tente novamente em alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(limiter);

router.get('/config', publicoController.getConfig);
router.get('/pesquisas/:slug', publicoController.getPesquisaPublica);
router.post('/pesquisas/:slug/recusa', publicoController.postRecusa);
router.post('/pesquisas/:slug/responder', publicoController.postResposta);

module.exports = router;
