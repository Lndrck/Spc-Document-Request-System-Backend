const express = require('express');
const TransactionController = require('../controllers/transactionController');
const AuthMiddleware = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');

// Create AuthMiddleware instance
const authMiddleware = new AuthMiddleware();

const router = express.Router();

/**
 * Transaction routes
 * Handles transaction day management operations
 */

/**
 * @route GET /api/transactions
 * @desc Get all transaction days
 * @access Public
 */
router.get('/', asyncHandler(async (req, res, next) => {
    const controller = new TransactionController(req.dbManager);
    await controller.getAllTransactionDays(req, res, next);
}));

/**
 * @route GET /api/transactions/range
 * @desc Get transaction days by date range
 * @access Public
 * @query {
 *   startDate: string,
 *   endDate: string
 * }
 */
router.get('/range', asyncHandler(async (req, res, next) => {
    const controller = new TransactionController(req.dbManager);
    await controller.getTransactionDaysByRange(req, res, next);
}));

/**
 * @route GET /api/transactions/upcoming
 * @desc Get upcoming transaction days
 * @access Public
 * @query {
 *   limit?: number
 * }
 */
router.get('/upcoming', asyncHandler(async (req, res, next) => {
    console.log('🔍 [ROUTE DEBUG] /transactions/upcoming endpoint HIT');
    console.log('🔍 [ROUTE DEBUG] Query params:', req.query);
    const controller = new TransactionController(req.dbManager);
    await controller.getUpcomingTransactionDays(req, res, next);
}));

/**
 * @route GET /api/transactions/published
 * @desc Get published transaction day (next available)
 * @access Public
 */
router.get('/published', asyncHandler(async (req, res, next) => {
    const controller = new TransactionController(req.dbManager);
    await controller.getPublishedTransactionDay(req, res, next);
}));

/**
 * @route GET /api/transactions/check-availability
 * @desc Check transaction availability for a specific date
 * @access Public
 * @query {
 *   date: string
 * }
 */
router.get('/check-availability', asyncHandler(async (req, res, next) => {
    const controller = new TransactionController(req.dbManager);
    await controller.checkAvailability(req, res, next);
}));

/**
 * @route GET /api/transactions/:id
 * @desc Get transaction day by ID
 * @access Public
 */
router.get('/:id', asyncHandler(async (req, res, next) => {
    const controller = new TransactionController(req.dbManager);
    await controller.getTransactionDayById(req, res, next);
}));

/**
 * @route POST /api/transactions
 * @desc Create new transaction day (Admin only) - enforces single active policy
 * @access Private (Admin only)
 * @body {
 *   date: string,
 *   status: string,
 *   time_start?: string,
 *   time_end?: string,
 *   message?: string
 * }
 */
router.post('/', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new TransactionController(req.dbManager);
    await controller.createTransactionDay(req, res, next);
}));

/**
 * @route POST /api/transactions/upsert
 * @desc Create or update transaction day (Admin only)
 * @access Private (Admin only)
 * @body {
 *   date: string,
 *   status: string,
 *   time_start?: string,
 *   time_end?: string,
 *   message?: string
 * }
 */
router.post('/upsert', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new TransactionController(req.dbManager);
    await controller.upsertTransactionDay(req, res, next);
}));

/**
 * @route PUT /api/transactions/:id
 * @desc Update transaction day (Admin + Staff)
 * @access Private (Admin + Staff)
 * @param {number} id - Transaction day ID
 * @body {
 *   status?: string,
 *   time_start?: string,
 *   time_end?: string,
 *   message?: string
 * }
 */
router.put('/:id', authMiddleware.verifyToken, authMiddleware.requireStaffOrAdmin, asyncHandler(async (req, res, next) => {
    const controller = new TransactionController(req.dbManager);
    await controller.updateTransactionDay(req, res, next);
}));

/**
 * @route DELETE /api/transactions/:id
 * @desc Delete transaction day (Admin only)
 * @access Private (Admin only)
 * @param {number} id - Transaction day ID
 */
router.delete('/:id', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new TransactionController(req.dbManager);
    await controller.deleteTransactionDay(req, res, next);
}));

/**
 * @route POST /api/transactions/bulk-update
 * @desc Bulk update transaction days (Admin only)
 * @access Private (Admin only)
 * @body {
 *   updates: Array<{
 *     date: string,
 *     status?: string,
 *     time_start?: string,
 *     time_end?: string,
 *     message?: string
 *   }>
 * }
 */
router.post('/bulk-update', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new TransactionController(req.dbManager);
    await controller.bulkUpdateTransactionDays(req, res, next);
}));

/**
 * @route PATCH /api/transactions/:id/toggle-publish
 * @desc Toggle transaction day publish status (Admin only)
 * @access Private (Admin only)
 * @param {number} id - Transaction day ID
 */
router.patch('/:id/toggle-publish', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new TransactionController(req.dbManager);
    await controller.togglePublishStatus(req, res, next);
}));

module.exports = router;
