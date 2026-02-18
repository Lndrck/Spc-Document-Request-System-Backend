/**
 * User model - handles user-related database operations
 */
class User {
    /**
     * @param {Object} dbManager - Database manager instance
     */
    constructor(dbManager) {
        this.dbManager = dbManager;
    }

    /**
     * Find user by email
     * @param {string} email - User email
     * @returns {Promise<Object>} User data
     */
    async findByEmail(email) {
        try {
            const query = 'SELECT * FROM users WHERE email = ? AND isActive = TRUE';
            const results = await this.dbManager.executeQuery(query, [email]);
            const user = results[0];
            
            if (user) {
                // Fetch departments from junction table
                const deptQuery = `
                    SELECT d.department_id, d.department_name
                    FROM user_departments ud
                    JOIN departments d ON ud.department_id = d.department_id
                    WHERE ud.user_id = ?`;
                const depts = await this.dbManager.executeQuery(deptQuery, [user.id]);
                user.departments = depts;
                user.department_name = depts.map(d => d.department_name).join(', ') || 'Not Assigned';
            }
            
            return user || null;
        } catch (error) {
            console.error('❌ Error finding user by email:', error.message);
            throw error;
        }
    }

    /**
     * Find user by ID
     * @param {number} id - User ID
     * @returns {Promise<Object>} User data
     */
    async findById(id) {
        const query = 'SELECT id, username, email, role, firstName, lastName, createdAt, lastLogin FROM users WHERE id = ? AND isActive = TRUE';
        const results = await this.dbManager.executeQuery(query, [id]);
        const user = results[0];
        
        if (user) {
            // Fetch departments from junction table
            const deptQuery = `
                SELECT d.department_id, d.department_name
                FROM user_departments ud
                JOIN departments d ON ud.department_id = d.department_id
                WHERE ud.user_id = ?`;
            const depts = await this.dbManager.executeQuery(deptQuery, [id]);
            user.departments = depts;
            user.department_name = depts.map(d => d.department_name).join(', ') || 'Not Assigned';
        }
        
        return user || null;
    }

    /**
     * Find user by username
     * @param {string} username - Username
     * @returns {Promise<Object>} User data
     */
    async findByUsername(username) {
        const query = 'SELECT * FROM users WHERE username = ? AND isActive = TRUE';
        const results = await this.dbManager.executeQuery(query, [username]);
        return results[0] || null;
    }

    /**
     * Get all users with pagination
     * @param {Object} options - Query options
     * @param {number} options.limit - Limit number of results
     * @param {number} options.offset - Offset for pagination
     * @param {string} options.role - Filter by role
     * @returns {Promise<Array>} Array of users
     */
    async getAll({ limit = 50, offset = 0, role = null } = {}) {
        let query = 'SELECT id, username, email, role, firstName, lastName, createdAt, lastLogin FROM users WHERE isActive = TRUE';
        const params = [];

        if (role) {
            query += ' AND role = ?';
            params.push(role);
        }

        query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        return await this.dbManager.executeQuery(query, params);
    }

    /**
     * Create new user
     * @param {Object} userData - User data
     * @param {string} userData.username - Username
     * @param {string} userData.email - Email
     * @param {string} userData.password - Hashed password
     * @param {string} userData.role - User role ('admin' or 'staff')
     * @param {string} userData.firstName - First name
     * @param {string} userData.lastName - Last name
     * @returns {Promise<Object>} Created user data
     */
    async create(userData) {
        const { username, email, password, role, firstName, lastName } = userData;

        const query = `
            INSERT INTO users (username, email, password, role, firstName, lastName)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        const result = await this.dbManager.executeQuery(query, [
            username, email, password, role, firstName, lastName
        ]);

        return await this.findById(result.insertId);
    }

    /**
     * Update user
     * @param {number} id - User ID
     * @param {Object} userData - Updated user data
     * @returns {Promise<Object>} Updated user data
     */
    async update(id, userData) {
        const allowedFields = ['username', 'email', 'firstName', 'lastName', 'role'];
        const updates = [];
        const values = [];

        Object.keys(userData).forEach(key => {
            if (allowedFields.includes(key) && userData[key] !== undefined) {
                updates.push(`${key} = ?`);
                values.push(userData[key]);
            }
        });

        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }

        updates.push('updatedAt = CURRENT_TIMESTAMP');
        values.push(id);

        const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
        await this.dbManager.executeQuery(query, values);

        return await this.findById(id);
    }

    /**
     * Update user password
     * @param {number} id - User ID
     * @param {string} hashedPassword - New hashed password
     * @returns {Promise<boolean>} Success status
     */
    async updatePassword(id, hashedPassword) {
        const query = 'UPDATE users SET password = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?';
        const result = await this.dbManager.executeQuery(query, [hashedPassword, id]);
        return result.affectedRows > 0;
    }

    /**
     * Update last login time
     * @param {number} id - User ID
     * @returns {Promise<boolean>} Success status
     */
    async updateLastLogin(id) {
        try {
            const query = 'UPDATE users SET lastLogin = NOW() WHERE id = ?';
            const result = await this.dbManager.executeQuery(query, [id]);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('❌ Error updating last login:', error.message);
            throw error;
        }
    }

    /**
     * Deactivate user
     * @param {number} id - User ID
     * @returns {Promise<boolean>} Success status
     */
    async deactivate(id) {
        const query = 'UPDATE users SET isActive = FALSE, updatedAt = CURRENT_TIMESTAMP WHERE id = ?';
        const result = await this.dbManager.executeQuery(query, [id]);
        return result.affectedRows > 0;
    }

    /**
     * Delete user (soft delete by deactivating)
     * @param {number} id - User ID
     * @returns {Promise<boolean>} Success status
     */
    async delete(id) {
        return await this.deactivate(id);
    }

    /**
     * Get user count
     * @param {string} role - Optional role filter
     * @returns {Promise<number>} User count
     */
    async count(role = null) {
        let query = 'SELECT COUNT(*) as count FROM users WHERE isActive = TRUE';
        const params = [];

        if (role) {
            query += ' AND role = ?';
            params.push(role);
        }

        const result = await this.dbManager.executeQuery(query, params);
        return result[0].count;
    }

    /**
     * Check if email exists
     * @param {string} email - Email to check
     * @param {number} excludeId - User ID to exclude from check
     * @returns {Promise<boolean>} True if email exists
     */
    async emailExists(email, excludeId = null) {
        let query = 'SELECT COUNT(*) as count FROM users WHERE email = ? AND isActive = TRUE';
        const params = [email];

        if (excludeId) {
            query += ' AND id != ?';
            params.push(excludeId);
        }

        const result = await this.dbManager.executeQuery(query, params);
        return result[0].count > 0;
    }

    /**
     * Check if username exists
     * @param {string} username - Username to check
     * @param {number} excludeId - User ID to exclude from check
     * @returns {Promise<boolean>} True if username exists
     */
    async usernameExists(username, excludeId = null) {
        let query = 'SELECT COUNT(*) as count FROM users WHERE username = ? AND isActive = TRUE';
        const params = [username];

        if (excludeId) {
            query += ' AND id != ?';
            params.push(excludeId);
        }

        const result = await this.dbManager.executeQuery(query, params);
        return result[0].count > 0;
    }

    /**
     * Update reset token for password recovery
     * @param {number} id - User ID
     * @param {string} hashedToken - Hashed reset token
     * @param {Date} expiry - Token expiry date
     * @returns {Promise<boolean>} Success status
     */
    async updateResetToken(id, hashedToken, expiry) {
        const query = 'UPDATE users SET reset_token = ?, reset_token_expiry = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?';
        const result = await this.dbManager.executeQuery(query, [hashedToken, expiry, id]);
        return result.affectedRows > 0;
    }

    /**
     * Find user by reset token
     * @param {string} hashedToken - Hashed reset token
     * @returns {Promise<Object>} User data including reset token fields
     */
    async findByResetToken(hashedToken) {
        const query = `
            SELECT id, username, email, role, firstName, lastName,
                   reset_token, reset_token_expiry
            FROM users
            WHERE reset_token = ? AND isActive = TRUE
        `;
        const results = await this.dbManager.executeQuery(query, [hashedToken]);
        return results[0] || null;
    }

    /**
     * Clear reset token after successful password reset
     * @param {number} id - User ID
     * @returns {Promise<boolean>} Success status
     */
    async clearResetToken(id) {
        const query = 'UPDATE users SET reset_token = NULL, reset_token_expiry = NULL, updatedAt = CURRENT_TIMESTAMP WHERE id = ?';
        const result = await this.dbManager.executeQuery(query, [id]);
        return result.affectedRows > 0;
    }
}

module.exports = User;
