const express = require('express');
const cicloController = require('../controllers/ciclo.controller');
const { autenticar, bloquearAdministrador } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(autenticar, bloquearAdministrador);

router.get('/', cicloController.getCiclos);
router.get('/:id/dashboard', cicloController.getDashboard);
router.get('/:id/clientes/:clienteId/historico', cicloController.getHistoricoCliente);
router.get('/:id/relatorio-pdf', cicloController.getRelatorioPdf);

module.exports = router;
