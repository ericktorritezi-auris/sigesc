const express = require('express');
const respostaController = require('../controllers/resposta.controller');
const { autenticar, bloquearAdministrador } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(autenticar, bloquearAdministrador);

router.get('/', respostaController.getRespostas);
router.get('/:id', respostaController.getRespostaDetalhe);
router.post('/:id/perguntas/:perguntaId/analisar-sentimento', respostaController.postAnalisarSentimento);
router.post('/:id/plano-acao', respostaController.postPlanoAcao);

module.exports = router;
