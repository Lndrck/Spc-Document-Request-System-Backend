const express = require('express');
const AnnouncementController = require('../controllers/announcementController');
const AuthMiddleware = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');

// Create AuthMiddleware instance
const authMiddleware = new AuthMiddleware();

const router = express.Router();

/**
 * Announcement routes
 * Handles announcement management operations
 */

/**
 * @route GET /api/announcements
 * @desc Get all announcements
 * @access Public
 */
router.get('/', asyncHandler(async (req, res, next) => {
    const controller = new AnnouncementController(req.dbManager);
    await controller.getAllAnnouncements(req, res, next);
}));

/**
 * @route GET /api/announcements/latest
 * @desc Get latest announcement for display
 * @access Public
 */
router.get('/latest', asyncHandler(async (req, res, next) => {
    const controller = new AnnouncementController(req.dbManager);
    await controller.getLatestAnnouncement(req, res, next);
}));

/**
 * @route GET /api/announcements/public
 * @desc Get published announcement for public display
 * @access Public
 */
router.get('/public', asyncHandler(async (req, res, next) => {
    const controller = new AnnouncementController(req.dbManager);
    await controller.getPublicAnnouncement(req, res, next);
}));

/**
 * @route GET /api/announcements/:id
 * @desc Get announcement by ID
 * @access Public
 */
router.get('/:id', asyncHandler(async (req, res, next) => {
    const controller = new AnnouncementController(req.dbManager);
    await controller.getAnnouncementById(req, res, next);
}));

/**
 * @route POST /api/announcements
 * @desc Create new announcement (Admin only)
 * @access Private (Admin only)
 * @body {
 *   title: string,
 *   content: string,
 *   is_published?: boolean
 * }
 */
router.post('/', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new AnnouncementController(req.dbManager);
    await controller.createAnnouncement(req, res, next);
}));

/**
 * @route PUT /api/announcements/:id
 * @desc Update announcement (Admin + Staff)
 * @access Private (Admin + Staff)
 * @param {number} id - Announcement ID
 * @body {
 *   title?: string,
 *   content?: string,
 *   is_published?: boolean
 * }
 */
router.put('/:id', authMiddleware.verifyToken, authMiddleware.requireStaffOrAdmin, asyncHandler(async (req, res, next) => {
    const controller = new AnnouncementController(req.dbManager);
    await controller.updateAnnouncement(req, res, next);
}));

/**
 * @route DELETE /api/announcements/:id
 * @desc Delete announcement (Admin only)
 * @access Private (Admin only)
 * @param {number} id - Announcement ID
 */
router.delete('/:id', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new AnnouncementController(req.dbManager);
    await controller.deleteAnnouncement(req, res, next);
}));

/**
 * @route PUT /api/announcements/:id/publish
 * @desc Publish specific announcement (Admin only)
 * @access Private (Admin only)
 * @param {number} id - Announcement ID
 */
router.put('/:id/publish', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new AnnouncementController(req.dbManager);
    await controller.publishAnnouncement(req, res, next);
}));

/**
 * @route PATCH /api/announcements/:id/toggle-publish
 * @desc Toggle announcement publish status (Admin only)
 * @access Private (Admin only)
 * @param {number} id - Announcement ID
 */
router.patch('/:id/toggle-publish', authMiddleware.verifyToken, authMiddleware.requireAdmin, asyncHandler(async (req, res, next) => {
    const controller = new AnnouncementController(req.dbManager);
    await controller.togglePublishStatus(req, res, next);
}));

module.exports = router;
