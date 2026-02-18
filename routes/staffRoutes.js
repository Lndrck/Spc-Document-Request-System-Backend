const express = require('express');
const StaffController = require('../controllers/staffController');
const AuthMiddleware = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');

// Create AuthMiddleware instance
const authMiddleware = new AuthMiddleware();

const router = express.Router();

/**
 * Staff routes
 * Handles staff-specific operations like request management and statistics
 */

/**
 * @route GET /api/staff/stats
 * @desc Get staff statistics
 * @access Private (Staff only)
 */
router.get('/stats', asyncHandler(async (req, res, next) => {
    await authMiddleware.verifyToken(req, res, async () => {
        await authMiddleware.requireStaff(req, res, async () => {
            const controller = new StaffController(req.dbManager);
            await controller.getStaffStats(req, res, next);
        });
    });
}));

/**
 * @route GET /api/staff/requests
 * @desc Get staff's assigned requests
 * @access Private (Staff only)
 * @query {
 *   status?: string,
 *   limit?: number,
 *   offset?: number
 * }
 */
router.get('/requests', asyncHandler(async (req, res, next) => {
    await authMiddleware.verifyToken(req, res, async () => {
        await authMiddleware.requireStaff(req, res, async () => {
            const controller = new StaffController(req.dbManager);
            await controller.getMyRequests(req, res, next);
        });
    });
}));

/**
 * @route DELETE /api/staff/requests/:id
 * @desc Delete request (staff can only delete requests from their assigned departments)
 * @access Private (Staff only)
 */
router.delete('/requests/:id', asyncHandler(async (req, res, next) => {
    await authMiddleware.verifyToken(req, res, async () => {
        await authMiddleware.requireStaff(req, res, async () => {
            const controller = new StaffController(req.dbManager);
            await controller.deleteRequest(req, res, next);
        });
    });
}));

/**
 * @route GET /api/staff/dashboard
 * @desc Get staff dashboard data
 * @access Private (Staff only)
 */
router.get('/dashboard', asyncHandler(async (req, res, next) => {
    await authMiddleware.verifyToken(req, res, async () => {
        await authMiddleware.requireStaff(req, res, async () => {
            const controller = new StaffController(req.dbManager);
            await controller.getDashboard(req, res, next);
        });
    });
}));

module.exports = router;
