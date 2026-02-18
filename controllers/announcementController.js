const Announcement = require('../models/Announcement');

/**
 * Announcement controller - handles announcement-related business logic
 */
class AnnouncementController {
    /**
     * @param {Object} dbManager - Database manager instance
     */
    constructor(dbManager) {
        this.dbManager = dbManager;
        this.announcementModel = new Announcement(dbManager);
    }

    /**
     * Get all announcements
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    getAllAnnouncements = async (req, res, next) => {
        try {
            const { includeUnpublished = false } = req.query;
            const announcements = await this.announcementModel.getAll(includeUnpublished === 'true');

            res.json({
                success: true,
                announcements: announcements,
                count: announcements.length
            });
        } catch (error) {
            console.error('Get all announcements error:', error);
            next(error);
        }
    };

    /**
     * Get latest announcement for display
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    getLatestAnnouncement = async (req, res, next) => {
        try {
            const announcement = await this.announcementModel.getLatest();

            res.json({
                success: true,
                announcement: announcement
            });
        } catch (error) {
            console.error('Get latest announcement error:', error);
            next(error);
        }
    };

    /**
     * Get announcement by ID
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    getAnnouncementById = async (req, res, next) => {
        try {
            const announcementId = parseInt(req.params.id);

            if (!announcementId || isNaN(announcementId)) {
                return res.status(400).json({
                    error: 'Invalid announcement ID',
                    message: 'Announcement ID must be a valid number'
                });
            }

            const announcement = await this.announcementModel.findById(announcementId);

            if (!announcement) {
                return res.status(404).json({
                    error: 'Announcement not found',
                    message: 'No announcement found with the provided ID'
                });
            }

            res.json({
                success: true,
                announcement: announcement
            });
        } catch (error) {
            console.error('Get announcement by ID error:', error);
            next(error);
        }
    };

    /**
     * Create new announcement
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    createAnnouncement = async (req, res, next) => {
        try {
            const { title, content, is_published = true } = req.body;

            // Validate required fields
            if (!title || !content) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Title and content are required'
                });
            }

            // Validate title length
            if (title.length > 255) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Title must be less than 255 characters'
                });
            }

            // Unpublish all existing announcements first (enforce single active announcement policy)
            await this.announcementModel.unpublishAll();

            // Create announcement
            const announcementData = {
                title: title.trim(),
                content: content.trim(),
                is_published: is_published
            };

            const newAnnouncement = await this.announcementModel.create(announcementData);

            // Emit real-time update event
            if (io) {
                io.emit('announcementUpdated');
            }

            res.status(201).json({
                success: true,
                message: 'Announcement published successfully',
                announcement: newAnnouncement
            });
        } catch (error) {
            console.error('Create announcement error:', error);
            next(error);
        }
    };

    /**
     * Update announcement
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    updateAnnouncement = async (req, res, next) => {
        try {
            const announcementId = parseInt(req.params.id);
            const { title, content, is_published } = req.body;

            console.log('🔍 UPDATE ANNOUNCEMENT DEBUG:', {
                announcementId,
                userRole: req.user?.role,
                userId: req.user?.id,
                requestBody: { title, content, is_published },
                hasIsPublished: is_published !== undefined
            });

            if (!announcementId || isNaN(announcementId)) {
                return res.status(400).json({
                    error: 'Invalid announcement ID',
                    message: 'Announcement ID must be a valid number'
                });
            }

            // Controller-level RBAC validation: Staff cannot toggle publish status
            if (req.user.role === 'staff' && is_published !== undefined) {
                console.log('🚫 STAFF BLOCKED: Attempted to change is_published field');
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'Staff are not allowed to publish or unpublish announcements'
                });
            }

            // Check if announcement exists
            const existingAnnouncement = await this.announcementModel.findById(announcementId);
            if (!existingAnnouncement) {
                return res.status(404).json({
                    error: 'Announcement not found',
                    message: 'No announcement found with the provided ID'
                });
            }

            // Validate title length if provided
            if (title && title.length > 255) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Title must be less than 255 characters'
                });
            }

            // If publishing this announcement, unpublish all others first (only admin can do this)
            if (is_published === true) {
                await this.announcementModel.unpublishAll();
            }

            // Update announcement
            const updateData = {};
            if (title !== undefined) updateData.title = title.trim();
            if (content !== undefined) updateData.content = content.trim();
            if (is_published !== undefined) updateData.is_published = is_published;

            const updatedAnnouncement = await this.announcementModel.update(announcementId, updateData);

            // Emit real-time update event if published status changed
            if (io && is_published !== undefined) {
                io.emit('announcementUpdated');
            }

            res.json({
                success: true,
                message: 'Announcement updated successfully',
                announcement: updatedAnnouncement
            });
        } catch (error) {
            console.error('Update announcement error:', error);
            next(error);
        }
    };

    /**
     * Delete announcement
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    deleteAnnouncement = async (req, res, next) => {
        try {
            const announcementId = parseInt(req.params.id);

            if (!announcementId || isNaN(announcementId)) {
                return res.status(400).json({
                    error: 'Invalid announcement ID',
                    message: 'Announcement ID must be a valid number'
                });
            }

            // Check if announcement exists
            const existingAnnouncement = await this.announcementModel.findById(announcementId);
            if (!existingAnnouncement) {
                return res.status(404).json({
                    error: 'Announcement not found',
                    message: 'No announcement found with the provided ID'
                });
            }

            // Delete announcement
            await this.announcementModel.delete(announcementId);

            // Note: Real-time updates removed

            res.json({
                success: true,
                message: 'Announcement deleted successfully'
            });
        } catch (error) {
            console.error('Delete announcement error:', error);
            next(error);
        }
    };

    /**
     * Publish specific announcement (unpublish all others)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    publishAnnouncement = async (req, res, next) => {
        try {
            const announcementId = parseInt(req.params.id);

            if (!announcementId || isNaN(announcementId)) {
                return res.status(400).json({
                    error: 'Invalid announcement ID',
                    message: 'Announcement ID must be a valid number'
                });
            }

            // Check if announcement exists
            const existingAnnouncement = await this.announcementModel.findById(announcementId);
            if (!existingAnnouncement) {
                return res.status(404).json({
                    error: 'Announcement not found',
                    message: 'No announcement found with the provided ID'
                });
            }

            // Unpublish all announcements first
            await this.announcementModel.unpublishAll();

            // Publish the selected announcement
            const updatedAnnouncement = await this.announcementModel.update(announcementId, {
                is_published: true
            });

            res.json({
                success: true,
                message: 'Announcement published successfully',
                announcement: updatedAnnouncement
            });
        } catch (error) {
            console.error('Publish announcement error:', error);
            next(error);
        }
    };

    /**
     * Get published announcement for public display
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    getPublicAnnouncement = async (req, res, next) => {
        try {
            const announcement = await this.announcementModel.getLatest();

            if (!announcement) {
                return res.json({
                    success: true,
                    announcement: null
                });
            }

            res.json({
                success: true,
                announcement: {
                    title: announcement.title,
                    content: announcement.content
                }
            });
        } catch (error) {
            console.error('Get public announcement error:', error);
            next(error);
        }
    };

    /**
     * Toggle announcement publish status
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    togglePublishStatus = async (req, res, next) => {
        try {
            const announcementId = parseInt(req.params.id);

            if (!announcementId || isNaN(announcementId)) {
                return res.status(400).json({
                    error: 'Invalid announcement ID',
                    message: 'Announcement ID must be a valid number'
                });
            }

            // Check if announcement exists
            const existingAnnouncement = await this.announcementModel.findById(announcementId);
            if (!existingAnnouncement) {
                return res.status(404).json({
                    error: 'Announcement not found',
                    message: 'No announcement found with the provided ID'
                });
            }

            // Toggle publish status
            const newStatus = !existingAnnouncement.is_published;

            // If publishing, unpublish all others first
            if (newStatus) {
                await this.announcementModel.unpublishAllExcept(announcementId);
            }

            const updatedAnnouncement = await this.announcementModel.update(announcementId, {
                is_published: newStatus
            });

            // Note: Real-time updates removed

            res.json({
                success: true,
                message: `Announcement ${newStatus ? 'published' : 'unpublished'} successfully`,
                announcement: updatedAnnouncement
            });
        } catch (error) {
            console.error('Toggle publish status error:', error);
            next(error);
        }
    };
}

module.exports = AnnouncementController;
