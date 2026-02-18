const express = require('express');
const AdminController = require('../controllers/adminController');
const AuthMiddleware = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');

// Create AuthMiddleware instance
const authMiddleware = new AuthMiddleware();

const router = express.Router();

/**
 * Admin routes
 * Handles admin-specific operations like user management, document management, and statistics
 */

/**
 * @route GET /api/admin/stats
 * @desc Get admin statistics
 * @access Private (Admin only)
 */
router.get('/stats', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new AdminController(req.dbManager);
    await controller.getAdminStats(req, res, next);
}));

/**
 * @route GET /api/admin/users
 * @desc Get all users (admin only)
 * @access Private (Admin only)
 * @query {
 *   role?: string,
 *   limit?: number,
 *   offset?: number
 * }
 */
router.get('/users', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new AdminController(req.dbManager);
    await controller.getAllUsers(req, res, next);
}));

/**
 * @route POST /api/admin/users
 * @desc Create new user (admin only)
 * @access Private (Admin only)
 * @body {
 *   username: string,
 *   email: string,
 *   password: string,
 *   role: string,
 *   firstName: string,
 *   lastName: string
 * }
 */
router.post('/users', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new AdminController(req.dbManager);
    await controller.createUser(req, res, next);
}));

/**
 * @route PUT /api/admin/users/:id
 * @desc Update user (admin only)
 * @access Private (Admin only)
 * @param {number} id - User ID
 * @body {
 *   username?: string,
 *   email?: string,
 *   role?: string,
 *   firstName?: string,
 *   lastName?: string,
 *   isActive?: boolean
 * }
 */
router.put('/users/:id', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new AdminController(req.dbManager);
    await controller.updateUser(req, res, next);
}));

/**
 * @route DELETE /api/admin/users/:id
 * @desc Delete user (admin only)
 * @access Private (Admin only)
 * @param {number} id - User ID
 */
router.delete('/users/:id', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new AdminController(req.dbManager);
    await controller.deleteUser(req, res, next);
}));

/**
 * @route GET /api/admin/requests
 * @desc Get all document requests with pagination (RBAC: Admin sees all, Staff sees filtered)
 * @access Private (Admin and Staff)
 * @query {
 *   page?: number,
 *   limit?: number,
 *   status?: number,
 *   search?: string
 * }
 */
router.get('/requests', authMiddleware.verifyToken, asyncHandler(async (req, res, next) => {
    const controller = new AdminController(req.dbManager);
    await controller.getAllDocumentRequests(req, res, next);
}));

/**
 * @route GET /api/admin/requests/:id
 * @desc Get a specific document request by ID (with RBAC)
 * @access Private (Admin or Staff with department access)
 * @params {
 *   id: number - Request ID
 * }
 */
router.get('/requests/:id', authMiddleware.verifyToken, asyncHandler(async (req, res, next) => {
    // Allow both admin and staff to access their respective requests
    const controller = new AdminController(req.dbManager);
    await controller.getRequestById(req, res, next);
}));

/**
 * @route GET /api/admin/documents
 * @desc Get all documents (admin only)
 * @access Private (Admin only)
 */
router.get('/documents', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new AdminController(req.dbManager);
    await controller.getDocuments(req, res, next);
}));

/**
 * @route POST /api/admin/documents
 * @desc Create new document (admin only)
 * @access Private (Admin only)
 * @body {
 *   name: string,
 *   price: number,
 *   year_options?: Array,
 *   sem_options?: Array
 * }
 */
router.post('/documents', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new AdminController(req.dbManager);
    await controller.createDocument(req, res, next);
}));

/**
 * @route PUT /api/admin/documents/:id
 * @desc Update document (admin only)
 * @access Private (Admin only)
 * @param {number} id - Document ID
 * @body {
 *   name?: string,
 *   price?: number,
 *   year_options?: Array,
 *   sem_options?: Array
 * }
 */
router.put('/documents/:id', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new AdminController(req.dbManager);
    await controller.updateDocument(req, res, next);
}));

/**
 * @route DELETE /api/admin/documents/:id
 * @desc Delete document (admin only)
 * @access Private (Admin only)
 * @param {number} id - Document ID
 */
router.delete('/documents/:id', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new AdminController(req.dbManager);
    await controller.deleteDocument(req, res, next);
}));

/**
 * @route GET /api/admin/purposes
 * @desc Get all purposes (admin only)
 * @access Private (Admin only)
 */
router.get('/purposes', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new AdminController(req.dbManager);
    await controller.getPurposes(req, res, next);
}));

/**
 * @route POST /api/admin/purposes
 * @desc Create new purpose (admin only)
 * @access Private (Admin only)
 * @body {
 *   name: string
 * }
 */
router.post('/purposes', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new AdminController(req.dbManager);
    await controller.createPurpose(req, res, next);
}));

/**
 * @route PUT /api/admin/purposes/:id
 * @desc Update purpose (admin only)
 * @access Private (Admin only)
 * @param {number} id - Purpose ID
 * @body {
 *   name?: string
 * }
 */
router.put('/purposes/:id', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new AdminController(req.dbManager);
    await controller.updatePurpose(req, res, next);
}));

/**
 * @route DELETE /api/admin/purposes/:id
 * @desc Delete purpose (admin only)
 * @access Private (Admin only)
 * @param {number} id - Purpose ID
 */
router.delete('/purposes/:id', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new AdminController(req.dbManager);
    await controller.deletePurpose(req, res, next);
}));

/**
 * @route GET /api/admin/documents-purposes
 * @desc Get all documents with their purposes (admin only)
 * @access Private (Admin only)
 */
router.get('/documents-purposes', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new AdminController(req.dbManager);
    await controller.getDocumentsWithPurposes(req, res, next);
}));

/**
 * @route POST /api/admin/documents-purposes
 * @desc Create new document with purposes (admin only)
 * @access Private (Admin only)
 * @body {
 *   name: string,
 *   price: number,
 *   purposes: Array of { purposeName: string }
 * }
 */
router.post('/documents-purposes', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new AdminController(req.dbManager);
    await controller.createDocumentWithPurposes(req, res, next);
}));

/**
 * @route PUT /api/admin/documents-purposes/:id
 * @desc Update document with purposes (admin only)
 * @access Private (Admin only)
 * @param {number} id - Document ID
 * @body {
 *   name?: string,
 *   price?: number,
 *   purposes?: Array of { id?: number, purposeName: string }
 * }
 */
router.put('/documents-purposes/:id', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new AdminController(req.dbManager);
    await controller.updateDocumentWithPurposes(req, res, next);
}));

/**
 * @route DELETE /api/admin/documents-purposes/:id
 * @desc Delete document and its purposes (admin only)
 * @access Private (Admin only)
 * @param {number} id - Document ID
 */
router.delete('/documents-purposes/:id', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new AdminController(req.dbManager);
    await controller.deleteDocumentWithPurposes(req, res, next);
}));

/**
 * @route PUT /api/admin/requests/:id/status
 * @desc Update request status (admin only)
 * @access Private (Admin only)
 * @param {number} id - Request ID
 * @body {
 *   statusId: number (1=PENDING, 2=PROCESSING, 3=READY_FOR_PICKUP, 4=RELEASED, 5=DECLINE)
 * }
 */
router.put('/requests/:id/status', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new AdminController(req.dbManager);
    await controller.updateRequestStatus(req, res, next);
}));

module.exports = router;