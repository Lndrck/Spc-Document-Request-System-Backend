const TransactionDay = require('../models/TransactionDay');

/**
 * Transaction controller - handles transaction day-related business logic
 */
class TransactionController {
    /**
     * @param {Object} dbManager - Database manager instance
     */
    constructor(dbManager) {
        this.dbManager = dbManager;
        this.transactionDayModel = new TransactionDay(dbManager);
    }

    /**
     * Get all transaction days
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    getAllTransactionDays = async (req, res, next) => {
        try {
            const { date, status } = req.query;
            const filters = {};
            
            if (date) filters.date = date;
            if (status) filters.status = status;
            
            const transactionDays = await this.transactionDayModel.getAll(filters);

            res.json({
                success: true,
                transactionDays: transactionDays,
                count: transactionDays.length
            });
        } catch (error) {
            console.error('Get all transaction days error:', error);
            next(error);
        }
    };

    /**
     * Get transaction days by date range
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    getTransactionDaysByRange = async (req, res, next) => {
        try {
            const { startDate, endDate } = req.query;

            if (!startDate || !endDate) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Start date and end date are required'
                });
            }

            const transactionDays = await this.transactionDayModel.getByDateRange(startDate, endDate);

            res.json({
                success: true,
                transactionDays: transactionDays,
                count: transactionDays.length,
                range: {
                    startDate,
                    endDate
                }
            });
        } catch (error) {
            console.error('Get transaction days by range error:', error);
            next(error);
        }
    };

    /**
     * Get upcoming transaction days
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    getUpcomingTransactionDays = async (req, res, next) => {
    try {
        // FIX: Ensure limit is a number, not a string from the query params
        const limit = parseInt(req.query.limit, 10) || 30;
        
        const transactionDays = await this.transactionDayModel.getUpcoming(limit);

        res.json({
            success: true,
            transactionDays: transactionDays
        });
    } catch (error) {
        console.error('Get upcoming transaction days error:', error);
        next(error);
    }
};

    /**
     * Get published transaction day (next available transaction day)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    getPublishedTransactionDay = async (req, res, next) => {
        try {
            const transactionDay = await this.transactionDayModel.getNextAvailable();

            res.json({
                success: true,
                transactionDay: transactionDay
            });
        } catch (error) {
            console.error('Get published transaction day error:', error);
            next(error);
        }
    };

    /**
     * Get transaction day by ID
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    getTransactionDayById = async (req, res, next) => {
        try {
            const transactionId = parseInt(req.params.id);

            if (!transactionId || isNaN(transactionId)) {
                return res.status(400).json({
                    error: 'Invalid transaction day ID',
                    message: 'Transaction day ID must be a valid number'
                });
            }

            const transactionDay = await this.transactionDayModel.findById(transactionId);

            if (!transactionDay) {
                return res.status(404).json({
                    error: 'Transaction day not found',
                    message: 'No transaction day found with the provided ID'
                });
            }

            res.json({
                success: true,
                transactionDay: transactionDay
            });
        } catch (error) {
            console.error('Get transaction day by ID error:', error);
            next(error);
        }
    };

    /**
     * Check transaction availability for a specific date
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    checkAvailability = async (req, res, next) => {
        try {
            const { date } = req.query;

            if (!date) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Date is required'
                });
            }

            const availability = await this.transactionDayModel.checkAvailability(date);

            res.json({
                success: true,
                date: date,
                availability: availability
            });
        } catch (error) {
            console.error('Check availability error:', error);
            next(error);
        }
    };

    /**
     * Create new transaction day (enforces single active policy)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    createTransactionDay = async (req, res, next) => {
        console.log('🚀 Starting createTransactionDay with data:', req.body);

        try {
            const { date, status, time_start, time_end, message } = req.body;
            console.log('📝 Parsed data:', { date, status, time_start, time_end, message });

            // Validate required fields
            if (!date) {
                console.log('❌ Date validation failed');
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Date field is required'
                });
            }

            // Validate date format (YYYY-MM-DD)
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(date)) {
                console.log('❌ Date format validation failed:', date);
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Date must be in YYYY-MM-DD format'
                });
            }

            // Validate status ENUM values (must match table exactly)
            const validStatuses = ['no transaction', 'limited', 'available'];
            const normalizedStatus = status || 'available';
            console.log('🔍 Status validation:', { status, normalizedStatus, validStatuses });

            if (!validStatuses.includes(normalizedStatus)) {
                console.log('❌ Status validation failed:', normalizedStatus);
                return res.status(400).json({
                    error: 'Validation failed',
                    message: `Status must be one of: ${validStatuses.join(', ')}. Received: "${status}"`
                });
            }

            // Validate time format if provided (HH:mm:ss or HH:mm)
            const timeRegex = /^(\d{2}):(\d{2})(:(\d{2}))?$/;
            if (time_start && !timeRegex.test(time_start)) {
                console.log('❌ Time start validation failed:', time_start);
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'time_start must be in HH:mm:ss or HH:mm format'
                });
            }
            if (time_end && !timeRegex.test(time_end)) {
                console.log('❌ Time end validation failed:', time_end);
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'time_end must be in HH:mm:ss or HH:mm format'
                });
            }

            console.log('✅ All validations passed');

            // Check if date already exists
            console.log('🔍 Checking if date exists:', date);
            const existingDay = await this.transactionDayModel.findByDate(date);
            if (existingDay) {
                console.log('❌ Date already exists:', existingDay);
                return res.status(409).json({
                    error: 'Conflict',
                    message: `Transaction day for date ${date} already exists`
                });
            }

            console.log('✅ Date does not exist, proceeding');

            // Unpublish all existing transaction days first (enforce single active policy)
            console.log('🔄 Unpublishing all existing transaction days');
            try {
                await this.transactionDayModel.unpublishAll();
                console.log('✅ Unpublish all completed');
            } catch (unpublishError) {
                console.error('❌ unpublishAll failed:', unpublishError);
                throw unpublishError; // Re-throw to surface the error
            }

            // Create new transaction day - use exact column names from table
            const transactionData = {
                date: date,
                status: normalizedStatus,
                time_start: time_start || null,
                time_end: time_end || null,
                message: message || null
            };

            console.log('📝 Final transaction data:', transactionData);

            // Use direct SQL insert to ensure exact column matching
            const insertQuery = `
                INSERT INTO transaction_days
                (date, status, time_start, time_end, message, is_published)
                VALUES (?, ?, ?, ?, ?, 1)
            `;

            console.log('🔍 Executing INSERT query');
            const result = await this.dbManager.executeQuery(insertQuery, [
                transactionData.date,
                transactionData.status,
                transactionData.time_start,
                transactionData.time_end,
                transactionData.message
            ]);

            console.log('✅ INSERT completed, result:', result);

            // Get the created transaction day
            console.log('🔍 Fetching created transaction day');
            const newTransactionDay = await this.transactionDayModel.findById(result.insertId);

            console.log('✅ Transaction day created successfully:', newTransactionDay);

            // Emit real-time update event
            if (global.io) {
                global.io.emit('transactionDayUpdated');
                console.log('📡 Real-time update emitted');
            }

            console.log('🎉 Transaction day creation completed successfully');
            res.status(201).json({
                success: true,
                message: 'Transaction day published successfully',
                transactionDay: newTransactionDay
            });

        } catch (error) {
            console.error('❌ Create transaction day error:', error);
            console.error('❌ Error stack:', error.stack);
            console.error('❌ Error code:', error.code);
            console.error('❌ Error message:', error.message);

            // Handle specific MySQL errors
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({
                    error: 'Duplicate entry',
                    message: 'A transaction day for this date already exists'
                });
            }

            if (error.code === 'ER_BAD_NULL_ERROR') {
                return res.status(400).json({
                    error: 'Database error',
                    message: 'Required field is missing or null'
                });
            }

            if (error.code === 'ER_DATA_TOO_LONG') {
                return res.status(400).json({
                    error: 'Data too long',
                    message: 'One of the fields exceeds the maximum allowed length'
                });
            }

            // Generic error for unexpected issues
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to create transaction day. Please try again.'
            });
        }
    };

    /**
     * Create or update transaction day
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    upsertTransactionDay = async (req, res, next) => {
        try {
            const { date, status, time_start, time_end, message } = req.body;

            // Validate required fields
            if (!date) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Date is required'
                });
            }

            // Validate status
            const validStatuses = ['no transaction', 'limited', 'available'];
            if (status && !validStatuses.includes(status)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Status must be one of: no transaction, limited, available'
                });
            }

            // Create or update transaction day
            const transactionData = {
                date,
                status: status || 'available',
                time_start: time_start || null,
                time_end: time_end || null,
                message: message || null
            };

            const transactionDay = await this.transactionDayModel.upsert(transactionData);
            
            // Note: Real-time updates removed
            const existing = await this.transactionDayModel.findByDate(date);
            // Previous real-time event: transaction:updated or transaction:created

            res.json({
                success: true,
                message: `Transaction day ${existing ? 'updated' : 'created'} successfully`,
                transactionDay: transactionDay
            });
        } catch (error) {
            console.error('Upsert transaction day error:', error);
            if (error.message.includes('already exists')) {
                return res.status(409).json({
                    error: 'Conflict',
                    message: error.message
                });
            }
            next(error);
        }
    };

    /**
     * Update transaction day
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    updateTransactionDay = async (req, res, next) => {
        try {
            const transactionId = parseInt(req.params.id);
            const { status, time_start, time_end, message } = req.body;

            if (!transactionId || isNaN(transactionId)) {
                return res.status(400).json({
                    error: 'Invalid transaction day ID',
                    message: 'Transaction day ID must be a valid number'
                });
            }

            // Validate status if provided
            const validStatuses = ['no transaction', 'limited', 'available'];
            if (status && !validStatuses.includes(status)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Status must be one of: no transaction, limited, available'
                });
            }

            // Check if transaction day exists
            const existingTransactionDay = await this.transactionDayModel.findById(transactionId);
            if (!existingTransactionDay) {
                return res.status(404).json({
                    error: 'Transaction day not found',
                    message: 'No transaction day found with the provided ID'
                });
            }

            // Update transaction day
            const updateData = {};
            if (status !== undefined) updateData.status = status;
            if (time_start !== undefined) updateData.time_start = time_start;
            if (time_end !== undefined) updateData.time_end = time_end;
            if (message !== undefined) updateData.message = message;

            const updatedTransactionDay = await this.transactionDayModel.update(transactionId, updateData);

            // Note: Real-time updates removed

            res.json({
                success: true,
                message: 'Transaction day updated successfully',
                transactionDay: updatedTransactionDay
            });
        } catch (error) {
            console.error('Update transaction day error:', error);
            next(error);
        }
    };

    /**
     * Delete transaction day
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    deleteTransactionDay = async (req, res, next) => {
        try {
            const transactionId = parseInt(req.params.id);

            if (!transactionId || isNaN(transactionId)) {
                return res.status(400).json({
                    error: 'Invalid transaction day ID',
                    message: 'Transaction day ID must be a valid number'
                });
            }

            // Check if transaction day exists
            const existingTransactionDay = await this.transactionDayModel.findById(transactionId);
            if (!existingTransactionDay) {
                return res.status(404).json({
                    error: 'Transaction day not found',
                    message: 'No transaction day found with the provided ID'
                });
            }

            // Delete transaction day
            await this.transactionDayModel.delete(transactionId);

            // Note: Real-time updates removed

            res.json({
                success: true,
                message: 'Transaction day deleted successfully'
            });
        } catch (error) {
            console.error('Delete transaction day error:', error);
            next(error);
        }
    };

    /**
     * Toggle transaction day publish status
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    togglePublishStatus = async (req, res, next) => {
        try {
            const transactionId = parseInt(req.params.id);

            if (!transactionId || isNaN(transactionId)) {
                return res.status(400).json({
                    error: 'Invalid transaction day ID',
                    message: 'Transaction day ID must be a valid number'
                });
            }

            // Check if transaction day exists
            const existingTransactionDay = await this.transactionDayModel.findById(transactionId);
            if (!existingTransactionDay) {
                return res.status(404).json({
                    error: 'Transaction day not found',
                    message: 'No transaction day found with the provided ID'
                });
            }

            // Toggle publish status (available <-> no transaction)
            const newStatus = existingTransactionDay.status === 'available' ? 'no transaction' : 'available';
            const updatedTransactionDay = await this.transactionDayModel.update(transactionId, {
                status: newStatus
            });

            // Note: Real-time updates removed

            res.json({
                success: true,
                message: `Transaction day ${newStatus === 'available' ? 'published' : 'unpublished'} successfully`,
                transactionDay: updatedTransactionDay
            });
        } catch (error) {
            console.error('Toggle publish status error:', error);
            next(error);
        }
    };

    /**
     * Bulk update transaction days
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    bulkUpdateTransactionDays = async (req, res, next) => {
        try {
            const { updates } = req.body;

            if (!Array.isArray(updates) || updates.length === 0) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Updates array is required and must not be empty'
                });
            }

            const results = [];
            const errors = [];

            // Process each update
            for (const update of updates) {
                try {
                    const { date, status, time_start, time_end, message } = update;

                    if (!date) {
                        errors.push({ update, error: 'Date is required' });
                        continue;
                    }

                    const transactionData = {
                        date,
                        status: status || 'available',
                        time_start: time_start || null,
                        time_end: time_end || null,
                        message: message || null
                    };

                    const transactionDay = await this.transactionDayModel.upsert(transactionData);
                    results.push(transactionDay);
                } catch (error) {
                    errors.push({ update, error: error.message });
                }
            }

            // Note: Real-time updates removed

            res.json({
                success: true,
                message: `Bulk update completed. ${results.length} succeeded, ${errors.length} failed.`,
                results: results,
                errors: errors
            });
        } catch (error) {
            console.error('Bulk update transaction days error:', error);
            next(error);
        }
    };
}

module.exports = TransactionController;
