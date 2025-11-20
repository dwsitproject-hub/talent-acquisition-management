const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const adminUserController = require('../controllers/adminUserController');
const menuAccessController = require('../controllers/menuAccessController');

// All endpoints require auth; restrict by role
router.use(authenticate);

// List users
router.get('/users', authorize('SUPER_ADMIN', 'HRBP', 'TA_TEAM'), adminUserController.listUsers);

// Create user
router.post('/users', authorize('SUPER_ADMIN', 'TA_TEAM'), adminUserController.createUser);

// Update user
router.put('/users/:id', authorize('SUPER_ADMIN', 'TA_TEAM'), adminUserController.updateUser);

// Activate/Deactivate
router.patch('/users/:id/status', authorize('SUPER_ADMIN', 'TA_TEAM'), adminUserController.updateStatus);

// Reset password
router.post('/users/:id/reset-password', authorize('SUPER_ADMIN'), adminUserController.resetPassword);

// Menu Access Management (SUPER_ADMIN only)
router.get('/menu-access', authorize('SUPER_ADMIN', 'TA_TEAM'), menuAccessController.getMenuAccess);
router.put('/menu-access', authorize('SUPER_ADMIN'), menuAccessController.updateMenuAccess);

module.exports = router;


