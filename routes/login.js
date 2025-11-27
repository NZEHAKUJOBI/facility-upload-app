const express = require('express');
const loginController = require('../controllers/loginController');

const router = express.Router();

// Login routes
router.get('/login', loginController.getLogin);
router.post('/login', loginController.postLogin);
router.get('/logout', loginController.logout);

module.exports = router;
