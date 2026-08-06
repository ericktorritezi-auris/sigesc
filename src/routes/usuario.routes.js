const express = require('express');
const usuarioController = require('../controllers/usuario.controller');
const { autenticar, bloquearAdministrador } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(autenticar, bloquearAdministrador);

router.get('/', usuarioController.getUsuarios);
router.post('/', usuarioController.postUsuario);
router.put('/:id', usuarioController.putUsuario);

module.exports = router;
