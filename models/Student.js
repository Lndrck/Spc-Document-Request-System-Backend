/**
 * Student model - handles student-related database operations
 */
class Student {
    /**
     * @param {Object} dbManager - Database manager instance
     */
    constructor(dbManager) {
        this.dbManager = dbManager;
    }

    /**
     * Find student by ID
     * @param {number} id - Student ID
     * @returns {Promise<Object>} Student data
     */
    async findById(id) {
        const query = 'SELECT id, studentNumber, email, surname, firstName, middleInitial, contactNo, department_id, createdAt FROM students WHERE id = ?';
        const results = await this.dbManager.executeQuery(query, [id]);
        return results[0] || null;
    }

    /**
     * Find student by student number
     * @param {string} studentNumber - Student number
     * @returns {Promise<Object>} Student data
     */
    async findByStudentNumber(studentNumber) {
        const query = 'SELECT id, studentNumber, email, surname, firstName, middleInitial, contactNo, department_id, createdAt FROM students WHERE studentNumber = ?';
        const results = await this.dbManager.executeQuery(query, [studentNumber]);
        return results[0] || null;
    }

    /**
     * Get all students with pagination
     * @param {Object} options - Query options
     * @param {number} options.limit - Limit number of results
     * @param {number} options.offset - Offset for pagination
     * @returns {Promise<Array>} Array of students
     */
    async getAll({ limit = 50, offset = 0 } = {}) {
        const query = 'SELECT id, studentNumber, email, surname, firstName, middleInitial, contactNo, department_id, createdAt FROM students ORDER BY createdAt DESC LIMIT ? OFFSET ?';
        return await this.dbManager.executeQuery(query, [limit, offset]);
    }

    /**
     * Create new student
     * @param {Object} studentData - Student data
     * @param {string} studentData.studentNumber - Student number
     * @param {string} studentData.email - Email
     * @param {string} studentData.surname - Surname
     * @param {string} studentData.firstName - First name
     * @param {string} studentData.middleInitial - Middle initial
     * @param {string} studentData.contactNo - Contact number
     * @param {number} studentData.department_id - Department ID (optional)
     * @returns {Promise<Object>} Created student data
     */
    async create(studentData) {
        const { studentNumber, email, surname, firstName, middleInitial, contactNo, department_id } = studentData;

        const query = `
            INSERT INTO students (studentNumber, email, surname, firstName, middleInitial, contactNo, department_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await this.dbManager.executeQuery(query, [
            studentNumber, email, surname, firstName, middleInitial, contactNo, department_id
        ]);

        return await this.findById(result.insertId);
    }

    /**
     * Update student
     * @param {number} id - Student ID
     * @param {Object} studentData - Updated student data
     * @returns {Promise<Object>} Updated student data
     */
    async update(id, studentData) {
        const allowedFields = ['studentNumber', 'email', 'surname', 'firstName', 'middleInitial', 'contactNo', 'department_id'];
        const updates = [];
        const values = [];

        Object.keys(studentData).forEach(key => {
            if (allowedFields.includes(key) && studentData[key] !== undefined) {
                updates.push(`${key} = ?`);
                values.push(studentData[key]);
            }
        });

        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }

        updates.push('updatedAt = CURRENT_TIMESTAMP');
        values.push(id);

        const query = `UPDATE students SET ${updates.join(', ')} WHERE id = ?`;
        await this.dbManager.executeQuery(query, values);

        return await this.findById(id);
    }

    /**
     * Get student count
     * @returns {Promise<number>} Student count
     */
    async count() {
        const result = await this.dbManager.executeQuery('SELECT COUNT(*) as count FROM students', []);
        return result[0].count;
    }

    /**
     * Check if student number exists
     * @param {string} studentNumber - Student number to check
     * @param {number} excludeId - Student ID to exclude from check
     * @returns {Promise<boolean>} True if student number exists
     */
    async studentNumberExists(studentNumber, excludeId = null) {
        let query = 'SELECT COUNT(*) as count FROM students WHERE studentNumber = ?';
        const params = [studentNumber];

        if (excludeId) {
            query += ' AND id != ?';
            params.push(excludeId);
        }

        const result = await this.dbManager.executeQuery(query, params);
        return result[0].count > 0;
    }

    /**
     * Check if email exists
     * @param {string} email - Email to check
     * @param {number} excludeId - Student ID to exclude from check
     * @returns {Promise<boolean>} True if email exists
     */
    async emailExists(email, excludeId = null) {
        let query = 'SELECT COUNT(*) as count FROM students WHERE email = ?';
        const params = [email];

        if (excludeId) {
            query += ' AND id != ?';
            params.push(excludeId);
        }

        const result = await this.dbManager.executeQuery(query, params);
        return result[0].count > 0;
    }
}

module.exports = Student;