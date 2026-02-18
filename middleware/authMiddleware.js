/**
 * @fileoverview Authentication middleware for JWT token verification and role-based access control
 *
 * This module provides essential security middleware for the Document Request System:
 * - JWT token verification and validation
 * - Role-based access control (admin/staff)
 * - Request authentication and authorization
 * - Token expiration handling
 * - Security error responses
 *
 * Security Features:
 * - Bearer token authentication
 * - Role-based route protection
 * - Automatic token expiration handling
 * - Detailed error messages for debugging
 * - Protection against common JWT vulnerabilities
 */

const jwt = require('jsonwebtoken'); // JSON Web Token library for secure authentication

/**
 * Authentication Middleware Class
 * Handles all authentication and authorization logic for the application
 *
 * Key Functions:
 * - Token verification and validation
 * - Role-based access control
 * - User context injection into requests
 * - Security error handling
 */
class AuthMiddleware {
    /**
     * Verify JWT token from request headers
     * Extracts and validates JWT tokens from Authorization headers
     *
     * Process:
     * 1. Extract Bearer token from Authorization header
     * 2. Verify token signature and expiration
     * 3. Decode user information from token
     * 4. Attach user data to request object
     * 5. Handle various token error scenarios
     *
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next middleware function
     */
    verifyToken = (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({
                    error: 'Access denied',
                    message: 'No token provided or invalid format'
                });
            }

            const token = authHeader.substring(7); // Remove 'Bearer ' prefix

            if (!token) {
                return res.status(401).json({
                    error: 'Access denied',
                    message: 'No token provided'
                });
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            req.user = decoded;
            next();

        } catch (error) {
            console.error('Token verification failed:', error.message);

            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    error: 'Token expired',
                    message: 'Your session has expired. Please login again.'
                });
            }

            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    error: 'Invalid token',
                    message: 'Authentication token is invalid'
                });
            }

            return res.status(500).json({
                error: 'Authentication error',
                message: 'Failed to authenticate user'
            });
        }
    };

    /**
     * Check if user has required role(s)
     * Higher-order function that returns middleware for role-based access control
     *
     * Authorization Logic:
     * - Verifies user is authenticated (token present and valid)
     * - Checks if user's role is in the allowed roles array
     * - Returns appropriate HTTP status codes for different scenarios
     * - Provides detailed error messages for debugging
     *
     * @param {Array<string>} allowedRoles - Array of roles allowed to access the route
     * @returns {Function} Express middleware function
     */
    requireRole = (allowedRoles) => {
        return (req, res, next) => {
            try {
                // Check if user data exists (set by verifyToken middleware)
                if (!req.user) {
                    return res.status(401).json({
                        error: 'Access denied',
                        message: 'Authentication required - please login first'
                    });
                }

                // Check if user's role is in the allowed roles list
                if (!allowedRoles.includes(req.user.role)) {
                    return res.status(403).json({
                        error: 'Access forbidden',
                        message: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`
                    });
                }

                // Role verification passed - continue to route handler
                next();

            } catch (error) {
                console.error('Role verification failed:', error.message);
                return res.status(500).json({
                    error: 'Authorization error',
                    message: 'Failed to verify user role'
                });
            }
        };
    };

    /**
     * Admin only access middleware
     * Convenience method for routes that require administrator privileges
     * Automatically generated from requireRole(['admin'])
     */
    requireAdmin = this.requireRole(['admin']);

    /**
     * Staff or Admin access middleware
     * Convenience method for routes accessible by both staff and administrators
     * Useful for most operational endpoints in the system
     */
    requireStaffOrAdmin = this.requireRole(['staff', 'admin']);

    /**
     * Staff only access middleware
     * Convenience method for routes restricted to staff members only
     * Administrators typically have access to all routes anyway
     */
    requireStaff = this.requireRole(['staff']);
}

module.exports = AuthMiddleware;