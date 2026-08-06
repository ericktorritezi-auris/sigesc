const express = require('express');
const configuracaoController = require('../controllers/configuracao.controller');
const { autenticar, bloquearAdministrador } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(autenticar, bloquearAdministrador);

router.get('/', configuracaoController.getConfiguracao);
router.put('/', configuracaoController.putConfiguracao);

module.exports = router;
