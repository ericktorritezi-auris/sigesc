const express = require('express');
const perfilController = require('../controllers/perfil.controller');
const { autenticar, bloquearAdministrador } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(autenticar, bloquearAdministrador);

router.get('/', perfilController.getPerfil);
router.put('/senha', perfilController.putSenha);

module.exports = router;
