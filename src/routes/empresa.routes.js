const express = require('express');
const empresaController = require('../controllers/empresa.controller');
const { autenticar, bloquearAdministrador } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(autenticar, bloquearAdministrador);
router.get('/', empresaController.getEmpresas);
router.post('/', empresaController.postEmpresa);
router.get('/:id', empresaController.getEmpresaDetalhe);
router.put('/:id', empresaController.putEmpresa);

module.exports = router;
