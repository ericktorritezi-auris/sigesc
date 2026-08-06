const express = require('express');
const cicloController = require('../controllers/ciclo.controller');
const { autenticar } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(autenticar);

router.get('/', cicloController.getCiclos);
router.get('/:id/dashboard', cicloController.getDashboard);
router.get('/:id/clientes/:clienteId/historico', cicloController.getHistoricoCliente);

module.exports = router;
