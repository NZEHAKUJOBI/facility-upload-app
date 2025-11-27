const express = require('express');
const userController = require('../controllers/userController');
const { isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// All user routes require admin authentication
router.use(isAdmin);

// Get all users
router.get('/', userController.getAllUsers);

// Create new user
router.post('/', userController.createUser);

// Update user
router.put('/:id', userController.updateUser);

// Delete user
router.delete('/:id', userController.deleteUser);

// Reset user password
router.post('/:id/reset-password', userController.resetPassword);

module.exports = router;
