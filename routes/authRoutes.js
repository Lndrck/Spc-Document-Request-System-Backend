const express = require('express');
const AuthController = require('../controllers/authController');
const AuthMiddleware = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');

// Create AuthMiddleware instance
const authMiddleware = new AuthMiddleware();

const router = express.Router();

/**
 * Authentication routes
 * Handles login, logout, profile management, and password changes
 */

/**
 * @route POST /api/auth/login
 * @desc Login user
 * @access Public
 * @param {string} email - User email
 * @param {string} password - User password
 */
router.post('/login', asyncHandler(async (req, res, next) => {
    const controller = new AuthController(req.dbManager);
    await controller.login(req, res, next);
}));

/**
 * @route POST /api/auth/logout
 * @desc Logout user
 * @access Private
 */
router.post('/logout', authMiddleware.verifyToken, asyncHandler(async (req, res, next) => {
    const controller = new AuthController(req.dbManager);
    await controller.logout(req, res, next);
}));

/**
 * @route GET /api/auth/profile
 * @desc Get user profile
 * @access Private
 */
router.get('/profile', authMiddleware.verifyToken, asyncHandler(async (req, res, next) => {
    const controller = new AuthController(req.dbManager);
    await controller.getProfile(req, res, next);
}));

/**
 * @route PUT /api/users/update-profile
 * @desc Update user profile
 * @access Private
 * @param {string} firstName - User first name
 * @param {string} lastName - User last name
 */
router.put('/update-profile', authMiddleware.verifyToken, asyncHandler(async (req, res, next) => {
    const controller = new AuthController(req.dbManager);
    await controller.updateProfile(req, res, next);
}));

/**
 * @route POST /api/auth/change-password
 * @desc Change user password
 * @access Private
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 */
router.post('/change-password', authMiddleware.verifyToken, asyncHandler(async (req, res, next) => {
    const controller = new AuthController(req.dbManager);
    await controller.changePassword(req, res, next);
}));

/**
 * @route POST /api/auth/forgot-password
 * @desc Request password reset
 * @access Public
 * @param {string} email - User email
 */
router.post('/forgot-password', asyncHandler(async (req, res, next) => {
    const controller = new AuthController(req.dbManager);
    await controller.forgotPassword(req, res, next);
}));

/**
 * @route POST /api/auth/reset-password
 * @desc Reset password using token
 * @access Public
 * @param {string} token - Reset token
 * @param {string} newPassword - New password
 */
router.post('/reset-password', asyncHandler(async (req, res, next) => {
    const controller = new AuthController(req.dbManager);
    await controller.resetPassword(req, res, next);
}));



module.exports = router;
