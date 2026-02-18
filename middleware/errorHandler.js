const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const errorHandler = (err, req, res, next) => {
    console.error('Unhandled error:', err);
    const status = err.statusCode || 500;
    res.status(status).json({
        success: false,
        error: err.name || 'Internal server error',
        message: err.message || 'An unexpected error occurred',
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
};

const notFound = (req, res, next) => {
    const error = new Error(`Not found - ${req.originalUrl}`);
    error.statusCode = 404;
    next(error);
};

module.exports = { errorHandler, notFound, asyncHandler };