const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validateBody, schemas } = require('../utils/validate');

router.post('/register', validateBody(schemas.register), authController.register);
router.post('/login', validateBody(schemas.login), authController.login);
router.get('/me', authenticate, authController.getMe); // authenticate runs first

module.exports = router;
