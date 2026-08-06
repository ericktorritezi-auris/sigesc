const express = require('express');
const respostaController = require('../controllers/resposta.controller');
const { autenticar, bloquearAdministrador } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(autenticar, bloquearAdministrador);

router.get('/', respostaController.getRespostas);
router.get('/:id', respostaController.getRespostaDetalhe);

module.exports = router;
