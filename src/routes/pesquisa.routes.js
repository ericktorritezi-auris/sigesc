const express = require('express');
const pesquisaController = require('../controllers/pesquisa.controller');
const { autenticar } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(autenticar);

router.post('/', pesquisaController.postPesquisa);
router.get('/', pesquisaController.getPesquisas);
router.get('/:id', pesquisaController.getPesquisaDetalhe);
router.put('/:id', pesquisaController.putPesquisa);

router.post('/:id/blocos/:blocoId/perguntas', pesquisaController.postPergunta);
router.put('/:id/perguntas/:perguntaId', pesquisaController.putPergunta);
router.delete('/:id/perguntas/:perguntaId', pesquisaController.deletePergunta);

router.post('/:id/clientes', pesquisaController.postCliente);
router.delete('/:id/clientes/:clienteId', pesquisaController.deleteCliente);

router.post('/:id/ativar', pesquisaController.postAtivar);
router.post('/:id/duplicar', pesquisaController.postDuplicar);

module.exports = router;
