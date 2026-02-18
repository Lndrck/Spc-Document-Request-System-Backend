const express = require('express');
const ReportController = require('../controllers/reportController');
const AuthMiddleware = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');

// Create AuthMiddleware instance
const authMiddleware = new AuthMiddleware();

const router = express.Router();

/**
 * Report Routes Configuration
 *
 * Endpoints for secure document request report generation with role-based access control
 *
 * Security Notes:
 * - All endpoints require JWT authentication (verifyToken middleware)
 * - Report generation requires admin or staff role
 * - Staff access is restricted to their assigned departments
 * - Proper HTTP status codes for various error scenarios
 *
 * Routes:
 * 1. POST /api/reports/document-requests
 *    - Generate document request report PDF
 *    - Query params: fromDate, toDate, departmentId (optional for admin)
 *    - Returns: PDF file binary
 *
 * 2. GET /api/reports/departments
 *    - Get available departments for current user
 *    - Returns: JSON with departments array
 */

/**
 * POST /api/reports/document-requests
 *
 * Generate a professional PDF report of document requests
 * WITH role-based and department-based access control
 *
 * Query Parameters:
 * - fromDate (required): Start date in YYYY-MM-DD format
 * - toDate (required): End date in YYYY-MM-DD format
 * - departmentId (optional for admin, required for staff): Department ID to filter by
 *
 * Security:
 * - Requires valid JWT token (Bearer <token>)
 * - Admin: can view all departments or specify one
 * - Staff: must specify their assigned department
 * - Prevents department parameter manipulation by validating against user's assignments
 *
 * Example Request (Admin - all departments):
 * POST /api/reports/document-requests?fromDate=2026-01-01&toDate=2026-02-16
 *
 * Example Request (Admin - specific department):
 * POST /api/reports/document-requests?fromDate=2026-01-01&toDate=2026-02-16&departmentId=1
 *
 * Example Request (Staff - their assigned department):
 * POST /api/reports/document-requests?fromDate=2026-01-01&toDate=2026-02-16&departmentId=2
 *
 * Success Response (200):
 * - Content-Type: application/pdf
 * - Body: PDF file binary
 * - Header: Content-Disposition: attachment; filename="..."
 *
 * Error Responses:
 * - 400: Missing/invalid parameters
 * - 401: Missing/invalid JWT token
 * - 403: User lacks required role or department access
 * - 404: Department not found
 * - 500: Server error during report generation
 */
router.post(
    '/document-requests',
    authMiddleware.verifyToken,
    asyncHandler(async (req, res, next) => {
        const controller = new ReportController(req.dbManager);
        await controller.generateReport(req, res, next);
    })
);

/**
 * GET /api/reports/departments
 *
 * Get list of departments accessible to the current user
 * Useful for frontend to populate department filter dropdown
 *
 * Security:
 * - Requires valid JWT token
 * - Admin: sees all departments
 * - Staff: sees only their assigned departments
 *
 * Success Response (200):
 * {
 *   "success": true,
 *   "role": "admin" | "staff",
 *   "departments": [
 *     { "department_id": 1, "department_name": "College of Computer Studies" },
 *     ...
 *   ],
 *   "count": 3
 * }
 *
 * Error Responses:
 * - 401: Missing/invalid JWT token
 * - 403: User doesn't have permission to access this endpoint
 * - 500: Server error
 */
router.get(
    '/departments',
    authMiddleware.verifyToken,
    asyncHandler(async (req, res, next) => {
        const controller = new ReportController(req.dbManager);
        await controller.getAvailableDepartments(req, res, next);
    })
);

module.exports = router;
