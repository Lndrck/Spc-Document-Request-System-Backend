/**
 * Document model - handles document type-related database operations
 */
class Document {
    /**
     * @param {Object} dbManager - Database manager instance
     */
    constructor(dbManager) {
        this.dbManager = dbManager;
    }

    /**
     * Get all documents
     * @param {boolean} activeOnly - Whether to return only active documents
     * @returns {Promise<Array>} Array of documents
     */
    async getAll(activeOnly = true) {
        let query = 'SELECT id, documentName, basePrice, isActive, createdAt, updatedAt FROM document_types';
        const params = [];

        if (activeOnly) {
            query += ' WHERE isActive = TRUE';
        }

        query += ' ORDER BY documentName ASC';

        return await this.dbManager.executeQuery(query, params);
    }

    /**
     * Find document by ID
     * @param {number} id - Document ID
     * @returns {Promise<Object>} Document data
     */
    async findById(id) {
        const query = 'SELECT id, documentName, basePrice, isActive, createdAt, updatedAt FROM document_types WHERE id = ?';
        const results = await this.dbManager.executeQuery(query, [id]);
        return results[0] || null;
    }

    /**
     * Find document by name
     * @param {string} name - Document name
     * @returns {Promise<Object>} Document data
     */
    async findByName(name) {
        const query = 'SELECT id, documentName, basePrice, isActive, createdAt, updatedAt FROM document_types WHERE documentName = ?';
        const results = await this.dbManager.executeQuery(query, [name]);
        return results[0] || null;
    }

    /**
     * Create new document
     * @param {Object} documentData - Document data
     * @returns {Promise<Object>} Created document data
     */
    async create(documentData) {
        const { documentName, basePrice, isActive = true } = documentData;

        const query = 'INSERT INTO document_types (documentName, basePrice, isActive) VALUES (?, ?, ?)';
        const result = await this.dbManager.executeQuery(query, [documentName, basePrice, isActive]);

        return await this.findById(result.insertId);
    }

    /**
     * Update document
     * @param {number} id - Document ID
     * @param {Object} documentData - Updated document data
     * @returns {Promise<Object>} Updated document data
     */
    async update(id, documentData) {
        const allowedFields = ['documentName', 'basePrice', 'isActive'];
        const updates = [];
        const values = [];

        Object.keys(documentData).forEach(key => {
            if (allowedFields.includes(key) && documentData[key] !== undefined) {
                updates.push(`${key} = ?`);
                values.push(documentData[key]);
            }
        });

        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }

        updates.push('updatedAt = CURRENT_TIMESTAMP');
        values.push(id);

        const query = `UPDATE document_types SET ${updates.join(', ')} WHERE id = ?`;
        await this.dbManager.executeQuery(query, values);

        return await this.findById(id);
    }

    /**
     * Delete document
     * @param {number} id - Document ID
     * @returns {Promise<boolean>} Success status
     */
    async delete(id) {
        // Check if document is being used in any requests
        const usageCheck = await this.dbManager.executeQuery(
            'SELECT COUNT(*) as count FROM request_documents WHERE documentTypeId = ?',
            [id]
        );

        if (usageCheck[0].count > 0) {
            throw new Error('Cannot delete document as it is being used in existing requests');
        }

        const query = 'DELETE FROM document_types WHERE id = ?';
        const result = await this.dbManager.executeQuery(query, [id]);
        return result.affectedRows > 0;
    }

    /**
     * Check if document name exists
     * @param {string} name - Document name to check
     * @param {number} excludeId - Document ID to exclude from check
     * @returns {Promise<boolean>} True if name exists
     */
    async nameExists(name, excludeId = null) {
        let query = 'SELECT COUNT(*) as count FROM document_types WHERE documentName = ?';
        const params = [name];

        if (excludeId) {
            query += ' AND id != ?';
            params.push(excludeId);
        }

        const result = await this.dbManager.executeQuery(query, params);
        return result[0].count > 0;
    }

    /**
     * Get document count
     * @param {boolean} activeOnly - Whether to count only active documents
     * @returns {Promise<number>} Document count
     */
    async count(activeOnly = true) {
        let query = 'SELECT COUNT(*) as count FROM document_types';
        const params = [];

        if (activeOnly) {
            query += ' WHERE isActive = TRUE';
        }

        const result = await this.dbManager.executeQuery(query, params);
        return result[0].count;
    }

    /**
     * Activate document
     * @param {number} id - Document ID
     * @returns {Promise<Object>} Updated document data
     */
    async activate(id) {
        const query = 'UPDATE document_types SET isActive = TRUE, updatedAt = CURRENT_TIMESTAMP WHERE id = ?';
        await this.dbManager.executeQuery(query, [id]);
        return await this.findById(id);
    }

    /**
     * Deactivate document
     * @param {number} id - Document ID
     * @returns {Promise<Object>} Updated document data
     */
    async deactivate(id) {
        // Check if document is being used in any requests
        const usageCheck = await this.dbManager.executeQuery(
            'SELECT COUNT(*) as count FROM request_documents WHERE documentTypeId = ?',
            [id]
        );

        if (usageCheck[0].count > 0) {
            throw new Error('Cannot deactivate document as it is being used in existing requests');
        }

        const query = 'UPDATE document_types SET isActive = FALSE, updatedAt = CURRENT_TIMESTAMP WHERE id = ?';
        await this.dbManager.executeQuery(query, [id]);
        return await this.findById(id);
    }

    /**
     * Get documents with pagination
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of documents
     */
    async getPaginated({ limit = 50, offset = 0, activeOnly = true } = {}) {
        let query = 'SELECT id, documentName, basePrice, isActive, createdAt, updatedAt FROM document_types';
        const params = [];

        if (activeOnly) {
            query += ' WHERE isActive = TRUE';
        }

        query += ' ORDER BY documentName ASC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        return await this.dbManager.executeQuery(query, params);
    }

    /**
     * Search documents by name
     * @param {string} searchTerm - Search term
     * @param {boolean} activeOnly - Whether to search only active documents
     * @returns {Promise<Array>} Array of matching documents
     */
    async searchByName(searchTerm, activeOnly = true) {
        let query = 'SELECT id, documentName, basePrice, isActive, createdAt, updatedAt FROM document_types WHERE documentName LIKE ?';
        const params = [`%${searchTerm}%`];

        if (activeOnly) {
            query += ' AND isActive = TRUE';
        }

        query += ' ORDER BY documentName ASC';

        return await this.dbManager.executeQuery(query, params);
    }
}

module.exports = Document;