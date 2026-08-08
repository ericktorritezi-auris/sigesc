const express = require('express');
const relatorioController = require('../controllers/relatorio.controller');
const { autenticar, bloquearAdministrador } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(autenticar, bloquearAdministrador);

router.get('/clientes', relatorioController.getClientes);
router.get('/clientes/:clienteId', relatorioController.getRelatorioCliente);
router.get('/clientes/:clienteId/pdf', relatorioController.getPdfCliente);
router.get('/dimensoes/:dimensao', relatorioController.getRelatorioDimensao);
router.get('/dimensoes/:dimensao/pdf', relatorioController.getPdfDimensao);

module.exports = router;
