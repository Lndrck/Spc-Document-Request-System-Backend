const DocumentRequest = require('../models/DocumentRequest');
const Department = require('../models/Department');
const PDFGenerator = require('../services/pdfGenerator');

/**
 * Report Controller - handles secure document request report generation
 * WITH role-based and department-based access control
 *
 * Security Features:
 * - JWT authentication required
 * - Role-based access control (Admin vs Staff)
 * - Department-based filtering for staff
 * - Prevents manual department parameter manipulation
 * - Input validation and sanitization
 * - Secure SQL parameter binding
 *
 * Access Rules:
 * - ADMIN: Can generate reports for ALL departments
 * - STAFF: Can ONLY generate reports for departments assigned to them
 */
class ReportController {
    /**
     * @param {Object} dbManager - Database manager instance
     */
    constructor(dbManager) {
        this.dbManager = dbManager;
        this.documentRequestModel = new DocumentRequest(dbManager);
        this.departmentModel = new Department(dbManager);
        this.pdfGenerator = new PDFGenerator();
    }

    /**
     * Validate and parse date parameter
     * @param {string} dateStr - Date string (YYYY-MM-DD format)
     * @returns {Object} { isValid: boolean, date: Date, error: string }
     */
    validateDate = (dateStr) => {
        if (!dateStr) {
            return { isValid: false, error: 'Date is required' };
        }

        // Check format YYYY-MM-DD
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateStr)) {
            return { isValid: false, error: 'Date must be in YYYY-MM-DD format' };
        }

        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            return { isValid: false, error: 'Invalid date value' };
        }

        return { isValid: true, date };
    };

    /**
     * Validate date range
     * @param {Date} fromDate - Start date
     * @param {Date} toDate - End date
     * @returns {Object} { isValid: boolean, error: string }
     */
    validateDateRange = (fromDate, toDate) => {
        if (fromDate > toDate) {
            return { isValid: false, error: 'From date cannot be greater than To date' };
        }
        return { isValid: true };
    };

    /**
     * Get staff's assigned departments
     * @param {number} userId - Staff member's user ID
     * @returns {Promise<Array>} Array of department objects with id and name
     */
    getStaffDepartments = async (userId) => {
        try {
            const query = `
                SELECT d.department_id, d.department_name
                FROM user_departments ud
                JOIN departments d ON ud.department_id = d.department_id
                WHERE ud.user_id = ?
            `;
            return await this.dbManager.executeQuery(query, [userId]);
        } catch (error) {
            console.error('Error fetching staff departments:', error.message);
            throw error;
        }
    };

    /**
     * Verify staff has access to requested department
     * @param {number} userId - Staff member's user ID
     * @param {number} departmentId - Requested department ID
     * @returns {Promise<Object>} Department object if authorized, null otherwise
     */
    verifyStaffDepartmentAccess = async (userId, departmentId) => {
        try {
            const query = `
                SELECT d.department_id, d.department_name
                FROM user_departments ud
                JOIN departments d ON ud.department_id = d.department_id
                WHERE ud.user_id = ? AND d.department_id = ?
            `;
            const results = await this.dbManager.executeQuery(query, [userId, departmentId]);
            return results[0] || null;
        } catch (error) {
            console.error('Error verifying staff department access:', error.message);
            throw error;
        }
    };

    /**
     * Build secure SQL query based on user role
     * @param {number} departmentId - Department ID (validated)
     * @param {Date} fromDate - Start date
     * @param {Date} toDate - End date
     * @param {string} userRole - User role (admin or staff)
     * @returns {Object} { query: string, params: array }
     */
    buildReportQuery = (departmentId, fromDate, toDate, userRole) => {
        // Format dates for MySQL YYYY-MM-DD HH:MM:SS
        const fromDateStr = new Date(fromDate).toISOString().slice(0, 10) + ' 00:00:00';
        const toDateStr = new Date(toDate).toISOString().slice(0, 10) + ' 23:59:59';

        // Base query with all necessary joins and data
        // Using request_documents junction table and document_types for correct many-to-many relationship
        let query = `
            SELECT
                dr.id,
                dr.referenceNumber,
                /* FIX: Use s.studentNumber for students, but a.id for alumni */
                CASE
                    WHEN dr.requesterType = 'student' THEN s.studentNumber
                    ELSE CONCAT('ALU-', a.id)
                END as studentId,
                CASE
                    WHEN dr.requesterType = 'student' THEN CONCAT(s.surname, ', ', s.firstName, ' ', COALESCE(s.middleInitial, ''))
                    ELSE CONCAT(a.surname, ', ', a.firstName, ' ', COALESCE(a.middleInitial, ''))
                END as studentName,
                c.courseName as course,
                d.department_name,
                /* FIX: Use the verified request_documents and document_types tables */
                GROUP_CONCAT(dt.documentName SEPARATOR ', ') as documentType,
                SUM(rd.quantity) as totalQuantity,
                dr.createdAt as dateRequested,
                rs.statusName as status,
                COALESCE(u.firstName, 'N/A') as processedBy
            FROM document_requests dr
            LEFT JOIN students s ON dr.requesterId = s.id AND dr.requesterType = 'student'
            LEFT JOIN alumni a ON dr.requesterId = a.id AND dr.requesterType = 'alumni'
            LEFT JOIN courses c ON dr.courseId = c.id
            LEFT JOIN departments d ON dr.department_id = d.department_id
            LEFT JOIN request_statuses rs ON dr.statusId = rs.id
            LEFT JOIN users u ON dr.processedBy = u.id
            /* Use your verified junction and type tables */
            LEFT JOIN request_documents rd ON dr.id = rd.requestId
            LEFT JOIN document_types dt ON rd.documentTypeId = dt.id
            WHERE dr.createdAt BETWEEN ? AND ?
        `;

        const params = [fromDateStr, toDateStr];

        // Apply department filter
        if (userRole === 'staff') {
            query += ` AND dr.department_id = ?`;
            params.push(departmentId);
        }
        // If admin, no department filter - they see all

        // Group by request ID and order by date (most recent first)
        query += ` GROUP BY dr.id ORDER BY dr.createdAt DESC`;

        return { query, params };
    };

    /**
     * Generate document request report (main endpoint)
     * Enforces role-based and department-based access control
     *
     * @param {Object} req - Express request object with user data from JWT
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    generateReport = async (req, res, next) => {
        try {
            // =============== AUTHENTICATION & AUTHORIZATION ===============
            // This is already handled by authMiddleware.verifyToken + requireRole
            // req.user contains: id, email, role, and other JWT payload

            if (!req.user) {
                return res.status(401).json({
                    error: 'Authentication required',
                    message: 'User not authenticated'
                });
            }

            const userId = req.user.id;
            const userRole = req.user.role;

            // Only admin and staff can generate reports
            if (!['admin', 'staff'].includes(userRole)) {
                return res.status(403).json({
                    error: 'Access forbidden',
                    message: 'Only admin and staff can generate reports'
                });
            }

            // =============== INPUT VALIDATION ===============
            const { fromDate, toDate, departmentId } = req.query;

            // Validate dates exist
            if (!fromDate || !toDate) {
                return res.status(400).json({
                    error: 'Validation error',
                    message: 'Both fromDate and toDate are required'
                });
            }

            // Validate date formats
            const fromDateValidation = this.validateDate(fromDate);
            if (!fromDateValidation.isValid) {
                return res.status(400).json({
                    error: 'Validation error',
                    message: `Invalid fromDate: ${fromDateValidation.error}`
                });
            }

            const toDateValidation = this.validateDate(toDate);
            if (!toDateValidation.isValid) {
                return res.status(400).json({
                    error: 'Validation error',
                    message: `Invalid toDate: ${toDateValidation.error}`
                });
            }

            // Validate date range
            const dateRangeValidation = this.validateDateRange(
                fromDateValidation.date,
                toDateValidation.date
            );
            if (!dateRangeValidation.isValid) {
                return res.status(400).json({
                    error: 'Validation error',
                    message: dateRangeValidation.error
                });
            }

            // =============== ROLE-BASED ACCESS CONTROL ===============
            let reportDepartmentId;
            let reportDepartmentName = 'ALL DEPARTMENTS';

            if (userRole === 'admin') {
                // Admin can view all departments
                // If departmentId is provided, filter to that department
                // Otherwise, report on ALL departments
                if (departmentId) {
                    const deptIdInt = parseInt(departmentId, 10);
                    if (isNaN(deptIdInt) || deptIdInt <= 0) {
                        return res.status(400).json({
                            error: 'Validation error',
                            message: 'Invalid department ID format'
                        });
                    }

                    // Verify department exists
                    const dept = await this.departmentModel.findById(deptIdInt);
                    if (!dept) {
                        return res.status(404).json({
                            error: 'Not found',
                            message: 'Department not found'
                        });
                    }
                    reportDepartmentId = deptIdInt;
                    reportDepartmentName = dept.department_name;
                }
                // If no departmentId provided, stay null to fetch all
            } else if (userRole === 'staff') {
                // Staff MUST specify a department AND must have access to it
                if (!departmentId) {
                    return res.status(400).json({
                        error: 'Validation error',
                        message: 'Staff must specify a department ID'
                    });
                }

                const deptIdInt = parseInt(departmentId, 10);
                if (isNaN(deptIdInt) || deptIdInt <= 0) {
                    return res.status(400).json({
                        error: 'Validation error',
                        message: 'Invalid department ID format'
                    });
                }

                // =============== CRITICAL SECURITY CHECK ===============
                // Verify staff is assigned to this department
                // Prevents staff from manually manipulating departmentId parameter
                const authorizedDepartment = await this.verifyStaffDepartmentAccess(
                    userId,
                    deptIdInt
                );

                if (!authorizedDepartment) {
                    console.warn(
                        `SECURITY: Staff user ${userId} attempted unauthorized access to department ${deptIdInt}`
                    );
                    return res.status(403).json({
                        error: 'Access forbidden',
                        message: 'You do not have access to this department'
                    });
                }

                reportDepartmentId = deptIdInt;
                reportDepartmentName = authorizedDepartment.department_name;
            }

            // =============== FETCH DATA ===============
            const { query, params } = this.buildReportQuery(
                reportDepartmentId,
                fromDateValidation.date,
                toDateValidation.date,
                userRole
            );

            const reportData = await this.dbManager.executeQuery(query, params);

            // =============== AGGREGATE STATISTICS ===============
            const stats = {
                total: reportData.length,
                pending: reportData.filter(r => r.status === 'PENDING').length,
                processing: reportData.filter(r => r.status === 'PROCESSING').length,
                approved: reportData.filter(r => r.status === 'READY_FOR_PICKUP').length,
                released: reportData.filter(r => r.status === 'RELEASED').length,
                declined: reportData.filter(r => r.status === 'DECLINE').length
            };

            // =============== GENERATE PDF ===============
            const pdfBuffer = await this.pdfGenerator.generateReportPDF({
                title: `DOCUMENT REQUEST REPORT – ${reportDepartmentName}`,
                userRole,
                departmentName: reportDepartmentName,
                dateRange: {
                    from: fromDate,
                    to: toDate
                },
                statistics: stats,
                data: reportData,
                generatedBy: req.user.email,
                generatedAt: new Date()
            });

            // =============== SEND RESPONSE ===============
            // Set appropriate headers for PDF download
            const filename = `Document_Request_Report_${reportDepartmentName.replace(/\s+/g, '_')}_${fromDate}_to_${toDate}.pdf`;

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', pdfBuffer.length);

            res.send(pdfBuffer);

        } catch (error) {
            console.error('Report generation error:', error);
            next(error);
        }
    };

    /**
     * Get available departments for current user (helper endpoint)
     * Useful for frontend to populate department filter dropdown
     *
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    getAvailableDepartments = async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    error: 'Authentication required',
                    message: 'User not authenticated'
                });
            }

            const userRole = req.user.role;
            let departments = [];

            if (userRole === 'admin') {
                // Admins can see all departments
                departments = await this.departmentModel.getAll();
            } else if (userRole === 'staff') {
                // Staff can only see their assigned departments
                departments = await this.getStaffDepartments(req.user.id);
            } else {
                return res.status(403).json({
                    error: 'Access forbidden',
                    message: 'Only admin and staff can access this endpoint'
                });
            }

            res.json({
                success: true,
                role: userRole,
                departments: departments,
                count: departments.length
            });

        } catch (error) {
            console.error('Get departments error:', error);
            next(error);
        }
    };
}

module.exports = ReportController;
