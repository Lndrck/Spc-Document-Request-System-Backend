const express = require('express');
const EmailVerificationController = require('../controllers/emailVerificationController');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * Email Verification routes
 * Handles email verification for document requests
 */

/**
 * @route POST /api/send-verification-code
 * @desc Send verification email with OTP code
 * @access Public
 * @body {
 *   email: string (required)
 * }
 */
router.post('/send-verification-code', asyncHandler(async (req, res, next) => {
    // Get instances from app locals (set in server.js)
    const dbManager = req.app.locals.dbManager;
    const mailService = req.app.locals.mailService;

    console.log('🔍 Route /send-verification called');
    console.log('dbManager type:', typeof dbManager);
    console.log('mailService type:', typeof mailService);
    console.log('mailService has sendMail:', typeof mailService?.sendMail);

    if (!dbManager || !mailService || typeof mailService.sendMail !== 'function') {
        console.error('❌ Missing or invalid dependencies: dbManager, mailService, or mailService.sendMail');
        return res.status(500).json({
            error: 'Server configuration error',
            message: 'Email service not available'
        });
    }

    const controller = new EmailVerificationController(dbManager, mailService);
    await controller.sendVerificationEmail(req, res);
}));

/**
 * @route POST /api/verify-email-code
 * @desc Verify email code entered by user
 * @access Public
 * @body {
 *   email: string (required),
 *   code: string (required)
 * }
 */
router.post('/verify-email-code', asyncHandler(async (req, res, next) => {
    // Get instances from app locals (set in server.js)
    const dbManager = req.app.locals.dbManager;

    if (!dbManager) {
        console.error('❌ Missing dependencies: dbManager not injected');
        return res.status(500).json({
            error: 'Server configuration error',
            message: 'Database service not available'
        });
    }

    const controller = new EmailVerificationController(dbManager, null); // mailService not needed for verification
    await controller.verifyEmailCode(req, res);
}));

/**
 * @route POST /api/verify-email
 * @desc Verify email with token (called from verification link)
 * @access Public
 * @body {
 *   token: string (required)
 * }
 */
router.post('/verify-email', asyncHandler(async (req, res, next) => {
    // Get instances from app locals (set in server.js)
    const dbManager = req.app.locals.dbManager;
    const mailService = req.app.locals.mailService;

    if (!dbManager) {
        console.error('❌ Missing dependencies: dbManager not injected');
        return res.status(500).json({
            error: 'Server configuration error',
            message: 'Database service not available'
        });
    }

    const controller = new EmailVerificationController(dbManager, mailService);
    await controller.verifyEmailToken(req, res);
}));

/**
 * @route GET /api/check-verification
 * @desc Check if email is verified (for frontend polling)
 * @access Public
 * @query {
 *   email: string (required)
 * }
 */
router.get('/check-verification', asyncHandler(async (req, res, next) => {
    // Get instances from app locals (set in server.js)
    const dbManager = req.app.locals.dbManager;

    if (!dbManager) {
        console.error('❌ Missing dependencies: dbManager not injected');
        return res.status(500).json({
            error: 'Server configuration error',
            message: 'Database service not available'
        });
    }

    const controller = new EmailVerificationController(dbManager, null); // mailService not needed for checking
    await controller.checkEmailVerification(req, res);
}));

module.exports = router;
