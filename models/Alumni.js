/**
 * Alumni model - handles alumni-related database operations
 */
class Alumni {
    /**
     * @param {Object} dbManager - Database manager instance
     */
    constructor(dbManager) {
        this.dbManager = dbManager;
    }

    /**
     * Find alumni by ID
     * @param {number} id - Alumni ID
     * @returns {Promise<Object>} Alumni data
     */
    async findById(id) {
        const query = 'SELECT id, email, surname, firstName, middleInitial, contactNo, department_id, verification_photo, createdAt FROM alumni WHERE id = ?';
        const results = await this.dbManager.executeQuery(query, [id]);
        return results[0] || null;
    }

    /**
     * Find alumni by email
     * @param {string} email - Email
     * @returns {Promise<Object>} Alumni data
     */
    async findByEmail(email) {
        const query = 'SELECT id, email, surname, firstName, middleInitial, contactNo, department_id, verification_photo, createdAt FROM alumni WHERE email = ?';
        const results = await this.dbManager.executeQuery(query, [email]);
        return results[0] || null;
    }

    /**
     * Get all alumni with pagination
     * @param {Object} options - Query options
     * @param {number} options.limit - Limit number of results
     * @param {number} options.offset - Offset for pagination
     * @returns {Promise<Array>} Array of alumni
     */
    async getAll({ limit = 50, offset = 0 } = {}) {
        const query = 'SELECT id, email, surname, firstName, middleInitial, contactNo, department_id, verification_photo, createdAt FROM alumni ORDER BY createdAt DESC LIMIT ? OFFSET ?';
        return await this.dbManager.executeQuery(query, [limit, offset]);
    }

    /**
     * Create new alumni
     * @param {Object} alumniData - Alumni data
     * @param {string} alumniData.email - Email
     * @param {string} alumniData.surname - Surname
     * @param {string} alumniData.firstName - First name
     * @param {string} alumniData.middleInitial - Middle initial
     * @param {string} alumniData.contactNo - Contact number
     * @param {number} alumniData.department_id - Department ID (optional)
     * @returns {Promise<Object>} Created alumni data
     */
    async create(alumniData) {
        const { email, surname, firstName, middleInitial, contactNo, department_id } = alumniData;

        const query = `
            INSERT INTO alumni (email, surname, firstName, middleInitial, contactNo, department_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        const result = await this.dbManager.executeQuery(query, [
            email, surname, firstName, middleInitial, contactNo, department_id
        ]);

        return await this.findById(result.insertId);
    }

    /**
     * Update alumni
     * @param {number} id - Alumni ID
     * @param {Object} alumniData - Updated alumni data
     * @returns {Promise<Object>} Updated alumni data
     */
    async update(id, alumniData) {
        const allowedFields = ['email', 'surname', 'firstName', 'middleInitial', 'contactNo', 'department_id'];
        const updates = [];
        const values = [];

        Object.keys(alumniData).forEach(key => {
            if (allowedFields.includes(key) && alumniData[key] !== undefined) {
                updates.push(`${key} = ?`);
                values.push(alumniData[key]);
            }
        });

        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }

        updates.push('updatedAt = CURRENT_TIMESTAMP');
        values.push(id);

        const query = `UPDATE alumni SET ${updates.join(', ')} WHERE id = ?`;
        await this.dbManager.executeQuery(query, values);

        return await this.findById(id);
    }

    /**
     * Get alumni count
     * @returns {Promise<number>} Alumni count
     */
    async count() {
        const result = await this.dbManager.executeQuery('SELECT COUNT(*) as count FROM alumni', []);
        return result[0].count;
    }

    /**
     * Check if email exists
     * @param {string} email - Email to check
     * @param {number} excludeId - Alumni ID to exclude from check
     * @returns {Promise<boolean>} True if email exists
     */
    async emailExists(email, excludeId = null) {
        let query = 'SELECT COUNT(*) as count FROM alumni WHERE email = ?';
        const params = [email];

        if (excludeId) {
            query += ' AND id != ?';
            params.push(excludeId);
        }

        const result = await this.dbManager.executeQuery(query, params);
        return result[0].count > 0;
    }
}

module.exports = Alumni;