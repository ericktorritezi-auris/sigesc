const express = require('express');
const empresaController = require('../controllers/empresa.controller');
const { autenticar } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(autenticar);
router.get('/', empresaController.getEmpresas);
router.post('/', empresaController.postEmpresa);

module.exports = router;
