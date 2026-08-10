const express = require('express');
const adminController = require('../controllers/admin.controller');
const { autenticar, exigirAdministrador } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(autenticar, exigirAdministrador);

router.get('/gestores', adminController.getGestores);
router.post('/gestores', adminController.postGestor);
router.put('/gestores/:id', adminController.putGestor);

router.get('/backup', adminController.getBackup);
router.post('/reset', adminController.postReset);

router.get('/configuracao-rodape', adminController.getConfiguracaoRodape);
router.put('/configuracao-rodape', adminController.putConfiguracaoRodape);

module.exports = router;
