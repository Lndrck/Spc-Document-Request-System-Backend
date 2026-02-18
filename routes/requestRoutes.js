const express = require('express');
const { RequestController, getAllRequests } = require('../controllers/requestController');
const StaffController = require('../controllers/staffController');
const AuthMiddleware = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');

// Create middleware instances
const authMiddleware = new AuthMiddleware();

const router = express.Router();

/**
 * Document Request routes
 * Handles document request submission, tracking, and management
 */

/**
 * @route POST /api/requests
 * @desc Create new document request
 * @access Public
 * @body {
 *   requesterType: string,
 *   studentNumber?: string,
 *   spcEmail: string,
 *   surname: string,
 *   firstName: string,
 *   middleInitial?: string,
 *   suffix?: string,
 *   contactNo: string,
 *   course: string,
 *   year?: string,
 *   educationalLevel?: string,
 *   collegeDepartment: string,
 *   purposeOfRequest: string,
 *   otherPurpose?: string,
 *   tempReferenceNumber: string,
 *   documents: Array<{
 *     name: string,
 *     price: number,
 *     quantity: number,
 *     checked: boolean,
 *     year?: string,
 *     semester?: string
 *   }>
 * }
 */
router.post('/', asyncHandler(async (req, res, next) => {
    const controller = new RequestController(req.dbManager);
    await controller.createRequest(req, res, next);
}));

/**
 * @route POST /api/students
 * @desc Create new student document request
 * @access Public
 * @body {
 *   studentNumber: string,
 *   spcEmail: string,
 *   surname: string,
 *   firstName: string,
 *   middleInitial?: string,
 *   suffix?: string,
 *   contactNo: string,
 *   course: string,
 *   year?: string,
 *   educationalLevel?: string,
 *   purposeOfRequest: string,
 *   otherPurpose?: string,
 *   tempReferenceNumber: string,
 *   documents: Array<{
 *     name: string,
 *     price: number,
 *     quantity: number,
 *     checked: boolean,
 *     year?: string,
 *     semester?: string
 *   }>
 * }
 */
router.post('/students', asyncHandler(async (req, res, next) => {
    // Set requester type to student
    req.body.requesterType = 'student';
    const controller = new RequestController(req.dbManager);
    await controller.createRequest(req, res, next);
}));

/**
 * @route POST /api/alumni
 * @desc Create new alumni document request
 * @access Public
 * @body {
 *   spcEmail: string,
 *   surname: string,
 *   firstName: string,
 *   middleInitial?: string,
 *   suffix?: string,
 *   contactNo: string,
 *   course: string,
 *   collegeDepartment: number,
 *   purposeOfRequest: string,
 *   otherPurpose?: string,
 *   tempReferenceNumber: string,
 *   documents: Array<{
 *     name: string,
 *     price: number,
 *     quantity: number,
 *     checked: boolean,
 *     year?: string,
 *     semester?: string
 *   }>
 * }
 */
router.post('/alumni', asyncHandler(async (req, res, next) => {
    // Set requester type to alumni
    req.body.requesterType = 'alumni';
    const controller = new RequestController(req.dbManager);
    await controller.createRequest(req, res, next);
}));

/**
 * @route GET /api/requests/track/:referenceNumber
 * @desc Track request by reference number
 * @access Public
 * @param {string} referenceNumber - Request reference number
 */
router.get('/track/:referenceNumber', asyncHandler(async (req, res, next) => {
    const controller = new RequestController(req.dbManager);
    await controller.trackRequest(req, res, next);
}));

/**
 * @route GET /api/requests/:id
 * @desc Get request by ID (admin and staff only)
 * @access Private (Staff/Admin)
 * @param {number} id - Request ID
 */
router.get('/:id', asyncHandler(async (req, res, next) => {
    await authMiddleware.verifyToken(req, res, async () => {
        await authMiddleware.requireStaffOrAdmin(req, res, async () => {
            const controller = new RequestController(req.dbManager);
            await controller.getRequestById(req, res, next);
        });
    });
}));

/**
 * @route GET /api/requests
 * @desc Get all requests (admin and staff only)
 * @access Private (Staff/Admin)
 * @query {
 *   status?: string,
 *   limit?: number,
 *   offset?: number
 * }
 */
router.get('/', asyncHandler(async (req, res, next) => {
    await authMiddleware.verifyToken(req, res, async () => {
        await authMiddleware.requireStaffOrAdmin(req, res, async () => {
            await getAllRequests(req.dbManager, req, res, next);
        });
    });
}));

/**
 * @route PUT /api/requests/:id
 * @desc Update request status and details (staff and admin only)
 * @access Private (Staff/Admin)
 * @param {number} id - Request ID
 * @body {
 *   status?: string,
 *   statusId?: number,
 *   pickupStatusId?: number,
 *   scheduledPickup?: string,
 *   adminNotes?: string
 * }
 */
router.put('/:id', asyncHandler(async (req, res, next) => {
    await authMiddleware.verifyToken(req, res, async () => {
        await authMiddleware.requireStaffOrAdmin(req, res, async () => {
            const staffController = new StaffController(req.dbManager);
            await staffController.updateRequest(req, res, next);
        });
    });
}));

/**
 * @route DELETE /api/requests/:id
 * @desc Delete request (admin only)
 * @access Private (Admin)
 * @param {number} id - Request ID
 */
router.delete('/:id', asyncHandler(async (req, res, next) => {
    await authMiddleware.verifyToken(req, res, async () => {
        await authMiddleware.requireAdmin(req, res, async () => {
            const controller = new RequestController(req.dbManager);
            await controller.deleteRequest(req, res);
        });
    });
}));

/**
 * @route PUT /api/requests/:id/schedule
 * @desc Update request scheduled pickup date (staff and admin only)
 * @access Private (Staff/Admin)
 * @param {number} id - Request ID
 * @body {
 *   scheduledPickup: string (YYYY-MM-DD format)
 * }
 */
router.put('/:id/schedule', asyncHandler(async (req, res, next) => {
    // Verify authentication token
    authMiddleware.verifyToken(req, res, () => {
        // Check role permissions
        authMiddleware.requireStaffOrAdmin(req, res, () => {
            // Process the schedule update
            const controller = new RequestController(req.dbManager);
            controller.updateSchedule(req, res);
        });
    });
}));


/**
 * @route PUT /api/requests/:id/status
 * @desc Update request status only (staff and admin only)
 * @access Private (Staff/Admin)
 * @param {number} id - Request ID
 * @body {
 *   status: string
 * }
 */
router.put('/:id/status', asyncHandler(async (req, res, next) => {
    await authMiddleware.verifyToken(req, res, async () => {
        await authMiddleware.requireStaffOrAdmin(req, res, async () => {
            const controller = new RequestController(req.dbManager);
            await controller.updateRequest(req, res, next);
        });
    });
}));


module.exports = router;
