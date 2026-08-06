const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const { autenticar } = require('../middlewares/auth.middleware');

const router = express.Router();

// Protege a rota de login contra tentativas de força bruta.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { erro: 'Muitas tentativas de login. Tente novamente em alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, authController.postLogin);
router.get('/me', autenticar, authController.getMe);

module.exports = router;
