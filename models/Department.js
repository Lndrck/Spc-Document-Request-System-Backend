/**
 * Department model - handles department-related database operations
 */
class Department {
    /**
     * @param {Object} dbManager - Database manager instance
     */
    constructor(dbManager) {
        this.dbManager = dbManager;
    }

    /**
     * Get all departments
     * @returns {Promise<Array>} Array of departments
     */
    async getAll() {
        try {
            const query = 'SELECT department_id, department_name FROM departments ORDER BY department_name';
            const results = await this.dbManager.executeQuery(query);
            return results;
        } catch (error) {
            console.error('❌ Error fetching departments:', error.message);
            throw error;
        }
    }

    /**
     * Find department by ID
     * @param {number} id - Department ID
     * @returns {Promise<Object>} Department data
     */
    async findById(id) {
        try {
            const query = 'SELECT department_id, department_name FROM departments WHERE department_id = ?';
            const results = await this.dbManager.executeQuery(query, [id]);
            return results[0] || null;
        } catch (error) {
            console.error('❌ Error finding department by ID:', error.message);
            throw error;
        }
    }

    /**
     * Find department by name
     * @param {string} name - Department name
     * @returns {Promise<Object>} Department data
     */
    async findByName(name) {
        try {
            const trimmedName = name.trim();
            // Replace all types of line endings and extra spaces, then trim
            const query = `
                SELECT department_id, department_name 
                FROM departments 
                WHERE LOWER(
                    REPLACE(
                        REPLACE(
                            REPLACE(
                                TRIM(department_name), 
                                CHAR(13), 
                                ''
                            ), 
                            CHAR(10), 
                            ''
                        ),
                        '  ', 
                        ' '
                    )
                ) = LOWER(?)
            `;
            const results = await this.dbManager.executeQuery(query, [trimmedName]);
            return results[0] || null;
        } catch (error) {
            console.error('❌ Error finding department by name:', error.message);
            throw error;
        }
    }

    /**
     * Create new department
     * @param {string} name - Department name
     * @returns {Promise<Object>} Created department data
     */
    async create(name) {
        try {
            const query = 'INSERT INTO departments (department_name) VALUES (?)';
            const result = await this.dbManager.executeQuery(query, [name.trim()]);
            return await this.findById(result.insertId);
        } catch (error) {
            console.error('❌ Error creating department:', error.message);
            throw error;
        }
    }

    /**
     * Get or create department by name
     * @param {string} name - Department name
     * @returns {Promise<Object>} Department data
     */
    async getOrCreate(name) {
        try {
            let department = await this.findByName(name);
            if (!department) {
                department = await this.create(name);
            }
            return department;
        } catch (error) {
            console.error('❌ Error getting or creating department:', error.message);
            throw error;
        }
    }
}

module.exports = Department;
