const db = require('../config/db');

/**
 * TransactionDay model - handles database operations for transaction days
 */
class TransactionDay {
    constructor(dbManager) {
        this.dbManager = dbManager;
    }

    /**
     * Get all transaction days
     * @param {Object} filters - Optional filters (date, status)
     * @returns {Promise<Array>} Array of transaction days
     */
    async getAll(filters = {}) {
        try {
            let query = `
                SELECT id, date, status, time_start, time_end, message, is_published, created_at, updated_at
                FROM transaction_days
            `;

            const conditions = [];
            const values = [];

            if (filters.date) {
                conditions.push('date = ?');
                values.push(filters.date);
            }

            if (filters.status) {
                conditions.push('status = ?');
                values.push(filters.status);
            }

            // Always filter by is_published = 1 for public access
            if (filters.includeUnpublished !== true) {
                conditions.push('is_published = 1');
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' ORDER BY date ASC';

            return await this.dbManager.executeQuery(query, values);
        } catch (error) {
            console.error('Error fetching transaction days:', error);
            throw error;
        }
    }

    /**
     * Get transaction days for a specific date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Array>} Array of transaction days
     */
    async getByDateRange(startDate, endDate) {
        try {
            return await this.dbManager.executeQuery(`
                SELECT id, date, status, time_start, time_end, message, created_at, updated_at
                FROM transaction_days
                WHERE date BETWEEN ? AND ?
                ORDER BY date ASC
            `, [startDate, endDate]);
        } catch (error) {
            console.error('Error fetching transaction days by date range:', error);
            throw error;
        }
    }

    /**
     * Get transaction day by ID
     * @param {number} id - Transaction day ID
     * @returns {Promise<Object|null>} Transaction day object
     */
    async findById(id) {
        try {
            const result = await this.dbManager.executeQuery(
                'SELECT * FROM transaction_days WHERE id = ?',
                [id]
            );
            
            return result.length > 0 ? result[0] : null;
        } catch (error) {
            console.error('Error finding transaction day by ID:', error);
            throw error;
        }
    }

    /**
     * Get transaction day by date
     * @param {string} date - Date (YYYY-MM-DD format)
     * @returns {Promise<Object|null>} Transaction day object
     */
    async findByDate(date) {
        try {
            const result = await this.dbManager.executeQuery(
                'SELECT * FROM transaction_days WHERE date = ?',
                [date]
            );
            
            return result.length > 0 ? result[0] : null;
        } catch (error) {
            console.error('Error finding transaction day by date:', error);
            throw error;
        }
    }

    /**
     * Create or update transaction day
     * @param {Object} data - Transaction day data
     * @returns {Promise<Object>} Created/updated transaction day
     */
    async upsert(data) {
        try {
            const { date, status, time_start, time_end, message } = data;
            
            // Check if transaction day already exists
            const existing = await this.findByDate(date);
            
            if (existing) {
                // Update existing
                return await this.update(existing.id, data);
            } else {
                // Create new
                return await this.create(data);
            }
        } catch (error) {
            console.error('Error upserting transaction day:', error);
            throw error;
        }
    }

    /**
     * Create new transaction day
     * @param {Object} data - Transaction day data
     * @returns {Promise<Object>} Created transaction day
     */
    async create(data) {
        try {
            const { date, status = 'available', time_start, time_end, message, is_published = true } = data;

            // Check if date already exists
            const existing = await this.findByDate(date);
            if (existing) {
                throw new Error('Transaction day for this date already exists');
            }

            const result = await this.dbManager.executeQuery(
                'INSERT INTO transaction_days (date, status, time_start, time_end, message, is_published) VALUES (?, ?, ?, ?, ?, ?)',
                [date, status, time_start, time_end, message, is_published]
            );

            return await this.findById(result.insertId);
        } catch (error) {
            console.error('Error creating transaction day:', error);
            throw error;
        }
    }

    /**
     * Update transaction day
     * @param {number} id - Transaction day ID
     * @param {Object} data - Updated transaction day data
     * @returns {Promise<Object>} Updated transaction day
     */
    async update(id, data) {
        try {
            const { status, time_start, time_end, message, is_published } = data;

            let query = 'UPDATE transaction_days SET ';
            const updates = [];
            const values = [];

            if (status !== undefined) {
                updates.push('status = ?');
                values.push(status);
            }

            if (time_start !== undefined) {
                updates.push('time_start = ?');
                values.push(time_start);
            }

            if (time_end !== undefined) {
                updates.push('time_end = ?');
                values.push(time_end);
            }

            if (message !== undefined) {
                updates.push('message = ?');
                values.push(message);
            }

            if (is_published !== undefined) {
                updates.push('is_published = ?');
                values.push(is_published);
            }

            if (updates.length === 0) {
                throw new Error('No fields to update');
            }

            updates.push('updated_at = CURRENT_TIMESTAMP');
            values.push(id);

            query += updates.join(', ') + ' WHERE id = ?';

            await this.dbManager.executeQuery(query, values);

            return await this.findById(id);
        } catch (error) {
            console.error('Error updating transaction day:', error);
            throw error;
        }
    }

    /**
     * Delete transaction day
     * @param {number} id - Transaction day ID
     * @returns {Promise<boolean>} Success status
     */
    async delete(id) {
        try {
            const result = await this.dbManager.executeQuery(
                'DELETE FROM transaction_days WHERE id = ?',
                [id]
            );
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error deleting transaction day:', error);
            throw error;
        }
    }

    /**
     * Get upcoming transaction days (from today onwards)
     * @param {number} limit - Number of days to return
     * @returns {Promise<Array>} Array of upcoming transaction days
     */
    async getUpcoming(limit = 30) {
        try {
            // FIX: Ensure limit is a valid integer. 
            // If parseInt results in NaN, fall back to the default (30).
            const safeLimit = parseInt(limit, 10) || 30;

            return await this.dbManager.executeQuery(`
                SELECT id, date, status, time_start, time_end, message, created_at, updated_at
                FROM transaction_days
                WHERE date >= CURDATE()
                ORDER BY date ASC
                LIMIT ?
            `, [safeLimit]); // Use the sanitized safeLimit
        } catch (error) {
            console.error('Error fetching upcoming transaction days:', error);
            throw error;
        }
    }

    /**
     * Get next available transaction day (published)
     * @returns {Promise<Object|null>} Next available transaction day
     */
    async getNextAvailable() {
        try {
            const result = await this.dbManager.executeQuery(`
                SELECT id, date, status, time_start, time_end, message, created_at, updated_at
                FROM transaction_days
                WHERE date >= CURDATE() AND status != 'no transaction'
                ORDER BY date ASC
                LIMIT 1
            `);

            return result.length > 0 ? result[0] : null;
        } catch (error) {
            console.error('Error fetching next available transaction day:', error);
            throw error;
        }
    }

    /**
     * Check if transactions are available on a specific date
     * @param {string} date - Date to check (YYYY-MM-DD format)
     * @returns {Promise<Object>} Status and transaction info
     */
    async checkAvailability(date) {
        try {
            const transactionDay = await this.findByDate(date);

            if (!transactionDay) {
                return {
                    available: true,
                    status: 'available',
                    message: 'Normal transaction hours'
                };
            }

            return {
                available: transactionDay.status !== 'no transaction',
                status: transactionDay.status,
                time_start: transactionDay.time_start,
                time_end: transactionDay.time_end,
                message: transactionDay.message || null
            };
        } catch (error) {
            console.error('Error checking transaction availability:', error);
            throw error;
        }
    }

    /**
     * Unpublish all transaction days (set is_published = 0)
     * Used to enforce single active transaction day policy
     * @returns {Promise<number>} Number of rows affected
     */
    async unpublishAll() {
        try {
            const result = await this.dbManager.executeQuery(
                'UPDATE transaction_days SET is_published = 0, updated_at = CURRENT_TIMESTAMP'
            );

            console.log(`Unpublished ${result.affectedRows} transaction days`);
            return result.affectedRows;
        } catch (error) {
            console.error('Error unpublishing all transaction days:', error);
            throw error;
        }
    }
}

module.exports = TransactionDay;
