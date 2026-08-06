const express = require('express');
const lgpdController = require('../controllers/lgpd.controller');
const { autenticar, bloquearAdministrador } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(autenticar, bloquearAdministrador);

router.get('/', lgpdController.getConsentimentos);
router.get('/:id', lgpdController.getConsentimentoDetalhe);

module.exports = router;
