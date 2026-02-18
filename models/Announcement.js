const db = require('../config/db');

/**
 * Announcement model - handles database operations for announcements
 */
class Announcement {
    constructor(dbManager) {
        this.dbManager = dbManager;
    }

    /**
     * Get all announcements
     * @param {boolean} includeUnpublished - Include unpublished announcements
     * @returns {Promise<Array>} Array of announcements
     */
    async getAll(includeUnpublished = false) {
        try {
            let query = `
                SELECT id, title, content, created_at, updated_at, is_published
                FROM announcements
            `;
            
            if (!includeUnpublished) {
                query += ' WHERE is_published = TRUE';
            }
            
            query += ' ORDER BY created_at DESC';
            
            return await this.dbManager.executeQuery(query);
        } catch (error) {
            console.error('Error fetching announcements:', error);
            throw error;
        }
    }

    /**
     * Get latest announcement for display
     * @returns {Promise<Object|null>} Latest published announcement
     */
    async getLatest() {
        try {
            const result = await this.dbManager.executeQuery(`
                SELECT id, title, content, created_at, updated_at
                FROM announcements
                WHERE is_published = TRUE
                ORDER BY updated_at DESC
                LIMIT 1
            `);

            return result.length > 0 ? result[0] : null;
        } catch (error) {
            console.error('Error fetching latest announcement:', error);
            throw error;
        }
    }

    /**
     * Get announcement by ID
     * @param {number} id - Announcement ID
     * @returns {Promise<Object|null>} Announcement object
     */
    async findById(id) {
        try {
            const result = await this.dbManager.executeQuery(
                'SELECT * FROM announcements WHERE id = ?',
                [id]
            );
            
            return result.length > 0 ? result[0] : null;
        } catch (error) {
            console.error('Error finding announcement by ID:', error);
            throw error;
        }
    }

    /**
     * Create new announcement
     * @param {Object} data - Announcement data
     * @returns {Promise<Object>} Created announcement
     */
    async create(data) {
        try {
            const { title, content, is_published = true } = data;
            
            const result = await this.dbManager.executeQuery(
                'INSERT INTO announcements (title, content, is_published) VALUES (?, ?, ?)',
                [title, content, is_published]
            );
            
            return await this.findById(result.insertId);
        } catch (error) {
            console.error('Error creating announcement:', error);
            throw error;
        }
    }

    /**
     * Update announcement
     * @param {number} id - Announcement ID
     * @param {Object} data - Updated announcement data
     * @returns {Promise<Object>} Updated announcement
     */
    async update(id, data) {
        try {
            const { title, content, is_published } = data;
            
            let query = 'UPDATE announcements SET ';
            const updates = [];
            const values = [];
            
            if (title !== undefined) {
                updates.push('title = ?');
                values.push(title);
            }
            
            if (content !== undefined) {
                updates.push('content = ?');
                values.push(content);
            }
            
            if (is_published !== undefined) {
                updates.push('is_published = ?');
                values.push(is_published);
            }
            
            if (updates.length === 0) {
                throw new Error('No fields to update');
            }
            
            updates.push('updated_at = CURRENT_TIMESTAMP');
            values.push(id);
            
            query += updates.join(', ') + ' WHERE id = ?';
            
            await this.dbManager.executeQuery(query, values);
            
            return await this.findById(id);
        } catch (error) {
            console.error('Error updating announcement:', error);
            throw error;
        }
    }

    /**
     * Unpublish all announcements
     * @returns {Promise<boolean>} Success status
     */
    async unpublishAll() {
        try {
            const result = await this.dbManager.executeQuery(
                'UPDATE announcements SET is_published = FALSE'
            );

            return result.affectedRows >= 0;
        } catch (error) {
            console.error('Error unpublishing all announcements:', error);
            throw error;
        }
    }

    /**
     * Unpublish all announcements except the specified ID
     * @param {number} exceptId - Announcement ID to keep published
     * @returns {Promise<boolean>} Success status
     */
    async unpublishAllExcept(exceptId) {
        try {
            const result = await this.dbManager.executeQuery(
                'UPDATE announcements SET is_published = FALSE WHERE id != ?',
                [exceptId]
            );

            return result.affectedRows >= 0;
        } catch (error) {
            console.error('Error unpublishing announcements:', error);
            throw error;
        }
    }

    /**
     * Delete announcement
     * @param {number} id - Announcement ID
     * @returns {Promise<boolean>} Success status
     */
    async delete(id) {
        try {
            const result = await this.dbManager.executeQuery(
                'DELETE FROM announcements WHERE id = ?',
                [id]
            );

            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error deleting announcement:', error);
            throw error;
        }
    }
}

module.exports = Announcement;
