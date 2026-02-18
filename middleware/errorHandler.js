/**
 * @fileoverview Centralized error handling middleware for the Document Request System
 */

/**
 * Async error wrapper utility
 * Wraps async route handlers to catch promise rejections and pass them to next()
 */
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Global error handler middleware
 * Catches all errors and returns a consistent JSON response
 */
const errorHandler = (err, req, res, next) => {
    // Log for debugging (useful in Railway logs)
    console.error('Unhandled error:', err);

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(val => val.message);
        return res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: 'Invalid input data',
            errors: errors
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            error: 'Invalid token',
            message: 'Not authorized'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            error: 'Token expired',
            message: 'Please login again'
        });
    }

    // MySQL errors (Crucial for Railway)
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
            success: false,
            error: 'Duplicate entry',
            message: 'A record with this information already exists'
        });
    }

    // Default server error
    const status = err.statusCode || 500;
    res.status(status).json({
        success: false,
        error: err.name || 'Internal server error',
        message: err.message || 'An unexpected error occurred',
        // Show stack trace only in development
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
};

/**
 * 404 Not Found handler
 */
const notFound = (req, res, next) => {
    const error = new Error(`Not found - ${req.originalUrl}`);
    error.statusCode = 404;
    next(error);
};

module.exports = {
    errorHandler,
    notFound,
    asyncHandler
};