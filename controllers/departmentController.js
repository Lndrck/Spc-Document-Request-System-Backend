/**
 * Department controller - handles department-related API endpoints
 */
const Department = require('../models/Department');

/**
 * Department Controller Class
 * Manages all department-related operations
 */
class DepartmentController {
    /**
     * Initialize department controller
     * Sets up dependencies for department operations and database access
     *
     * @param {Object} dbManager - Database manager instance for data operations
     */
    constructor(dbManager) {
        this.dbManager = dbManager; // Database access and utilities
        this.departmentModel = new Department(dbManager); // Department data operations
    }

    /**
     * Get all departments
     * Retrieves all departments from the database
     *
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    getAllDepartments = async (req, res, next) => {
        try {
            console.log('📚 Fetching all departments');

            const departments = await this.departmentModel.getAll();

            console.log(`✅ Retrieved ${departments.length} departments`);

            res.json({
                success: true,
                data: departments,
                count: departments.length
            });

        } catch (error) {
            console.error('❌ Error fetching departments:', error.message);
            next(error);
        }
    };
}

module.exports = DepartmentController;