/**
 * Document Request model - handles document request-related database operations
 */
class DocumentRequest {
    /**
     * @param {Object} dbManager - Database manager instance
     */
    constructor(dbManager) {
        this.dbManager = dbManager;
    }

    /**
     * Create new document request
     * @param {Object} requestData - Request data
     * @returns {Promise<Object>} Created request data
     */
    async create(requestData) {
        const {
            requestId, requestNo, referenceNumber, requesterId, requesterType, courseId,
            purposeId, statusId = 1, pickupStatusId = 1, otherPurpose,
            totalAmount, documents, department_id, schoolYear, requestSemester
        } = requestData;

        if (!purposeId) {
            throw new Error('Purpose ID missing — request cannot be created');
        }

        if (!documents || documents.length === 0) {
            throw new Error('At least one document must be requested');
        }

        // Insert main request (include school_year and request_semester)
        const requestQuery = `
            INSERT INTO document_requests
            (requestId, requestNo, referenceNumber, requesterId, requesterType, courseId, purposeId,
             statusId, pickupStatusId, otherPurpose, totalAmount, department_id, school_year, request_semester)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const requestResult = await this.dbManager.executeQuery(requestQuery, [
            requestId, requestNo, referenceNumber, requesterId, requesterType, courseId, purposeId,
            statusId, pickupStatusId, otherPurpose, totalAmount, department_id, schoolYear, requestSemester
        ]);

        const newRequestId = requestResult.insertId;

        // Insert request documents if provided
        if (documents && documents.length > 0) {
            for (const doc of documents) {
                await this.addDocumentToRequest(newRequestId, doc);
            }
        }

        // Add initial tracking entry
        await this.addTrackingEntry(newRequestId, statusId, 'Request submitted and pending review');

        return await this.findById(newRequestId);
    }

    /**
     * Find request by ID with full details
     * @param {number} id - Request ID
     * @returns {Promise<Object>} Request data with joined information
     */
    async findById(id) {
        const query = `
            SELECT
                dr.id, dr.requestId, dr.requestNo, dr.referenceNumber,
                dr.scheduledPickup, dr.dateProcessed, dr.dateCompleted,
                dr.totalAmount, dr.adminNotes, dr.createdAt, dr.updatedAt, dr.department_id,
                CASE
                    WHEN dr.requesterType = 'student' THEN s.studentNumber
                    ELSE NULL
                END as studentNumber,
                CASE
                    WHEN dr.requesterType = 'student' THEN s.email
                    WHEN dr.requesterType = 'alumni' THEN a.email
                END as email,
                CASE
                    WHEN dr.requesterType = 'student' THEN s.surname
                    WHEN dr.requesterType = 'alumni' THEN a.surname
                END as surname,
                CASE
                    WHEN dr.requesterType = 'student' THEN s.firstName
                    WHEN dr.requesterType = 'alumni' THEN a.firstName
                END as firstName,
                CASE
                    WHEN dr.requesterType = 'student' THEN s.middleInitial
                    WHEN dr.requesterType = 'alumni' THEN a.middleInitial
                END as middleInitial,
                CASE
                    WHEN dr.requesterType = 'student' THEN s.contactNo
                    WHEN dr.requesterType = 'alumni' THEN a.contactNo
                END as contactNo,
                CASE
                    WHEN dr.requesterType = 'alumni' THEN a.verification_photo
                    ELSE NULL
                END as verification_photo,
                dr.requesterType,
                c.courseName as course, c.educationalLevel as year,
                COALESCE(rp.purposeName, 'N/A') as purposeOfRequest,
                dr.otherPurpose,
                rs.statusName as status,
                ps.statusName as pickupStatus
            FROM document_requests dr
            LEFT JOIN students s ON dr.requesterId = s.id AND dr.requesterType = 'student'
            LEFT JOIN alumni a ON dr.requesterId = a.id AND dr.requesterType = 'alumni'
            LEFT JOIN courses c ON dr.courseId = c.id
            LEFT JOIN request_purposes rp ON dr.purposeId = rp.id
            LEFT JOIN request_statuses rs ON dr.statusId = rs.id
            LEFT JOIN pickup_statuses ps ON dr.pickupStatusId = ps.id
            WHERE dr.id = ?
        `;

        const results = await this.dbManager.executeQuery(query, [id]);
        return results[0] || null;
    }

    /**
     * Find request by reference number
     * @param {string} referenceNumber - Reference number
     * @returns {Promise<Object>} Request data
     */
    async findByReferenceNumber(referenceNumber) {
        const query = `
            SELECT
                dr.id, dr.requestId, dr.requestNo, dr.referenceNumber,
                dr.scheduledPickup, dr.dateProcessed, dr.dateCompleted,
                dr.totalAmount, dr.adminNotes, dr.createdAt, dr.updatedAt, dr.department_id,
                CASE
                    WHEN dr.requesterType = 'student' THEN s.studentNumber
                    ELSE NULL
                END as studentNumber,
                CASE
                    WHEN dr.requesterType = 'student' THEN s.email
                    WHEN dr.requesterType = 'alumni' THEN a.email
                END as email,
                CASE
                    WHEN dr.requesterType = 'student' THEN s.surname
                    WHEN dr.requesterType = 'alumni' THEN a.surname
                END as surname,
                CASE
                    WHEN dr.requesterType = 'student' THEN s.firstName
                    WHEN dr.requesterType = 'alumni' THEN a.firstName
                END as firstName,
                CASE
                    WHEN dr.requesterType = 'student' THEN s.middleInitial
                    WHEN dr.requesterType = 'alumni' THEN a.middleInitial
                END as middleInitial,
                CASE
                    WHEN dr.requesterType = 'student' THEN s.contactNo
                    WHEN dr.requesterType = 'alumni' THEN a.contactNo
                END as contactNo,
                CASE
                    WHEN dr.requesterType = 'alumni' THEN a.verification_photo
                    ELSE NULL
                END as verification_photo,
                dr.requesterType,
                c.courseName as course, c.educationalLevel as year,
                COALESCE(rp.purposeName, 'N/A') as purposeOfRequest,
                dr.otherPurpose,
                rs.statusName as status,
                ps.statusName as pickupStatus
            FROM document_requests dr
            LEFT JOIN students s ON dr.requesterId = s.id AND dr.requesterType = 'student'
            LEFT JOIN alumni a ON dr.requesterId = a.id AND dr.requesterType = 'alumni'
            LEFT JOIN courses c ON dr.courseId = c.id
            LEFT JOIN request_purposes rp ON dr.purposeId = rp.id
            LEFT JOIN request_statuses rs ON dr.statusId = rs.id
            LEFT JOIN pickup_statuses ps ON dr.pickupStatusId = ps.id
            WHERE dr.referenceNumber = ?
        `;

        const results = await this.dbManager.executeQuery(query, [referenceNumber]);
        return results[0] || null;
    }

    /**
     * Get all requests with pagination and filters
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of requests
     */
    async getAll({ status = null, limit = 50, offset = 0, processedBy = null, department_id = null, programs = null } = {}) {
        let query = `
            SELECT
                dr.id, dr.requestId, dr.requestNo, dr.referenceNumber,
                dr.scheduledPickup, dr.totalAmount, dr.createdAt, dr.updatedAt, dr.department_id,
                CASE
                    WHEN dr.requesterType = 'student' THEN s.studentNumber
                    ELSE NULL
                END as studentNumber,
                CASE
                    WHEN dr.requesterType = 'student' THEN s.email
                    WHEN dr.requesterType = 'alumni' THEN a.email
                END as email,
                CASE
                    WHEN dr.requesterType = 'student' THEN s.surname
                    WHEN dr.requesterType = 'alumni' THEN a.surname
                END as surname,
                CASE
                    WHEN dr.requesterType = 'student' THEN s.firstName
                    WHEN dr.requesterType = 'alumni' THEN a.firstName
                END as firstName,
                CASE
                    WHEN dr.requesterType = 'student' THEN s.middleInitial
                    WHEN dr.requesterType = 'alumni' THEN a.middleInitial
                END as middleInitial,
                CASE
                    WHEN dr.requesterType = 'student' THEN s.contactNo
                    WHEN dr.requesterType = 'alumni' THEN a.contactNo
                END as contactNo,
                CASE
                    WHEN dr.requesterType = 'alumni' THEN a.verification_photo
                    ELSE NULL
                END as verification_photo,
                dr.requesterType,
                c.courseName as course, c.educationalLevel as year,
                COALESCE(rp.purposeName, 'N/A') as purposeOfRequest,
                COALESCE(
                    GROUP_CONCAT(DISTINCT dt.documentName ORDER BY dt.documentName SEPARATOR ', '),
                    'N/A'
                ) AS documentTypes,
                rs.statusName as status,
                ps.statusName as pickupStatus
            FROM document_requests dr
            LEFT JOIN students s ON dr.requesterId = s.id AND dr.requesterType = 'student'
            LEFT JOIN alumni a ON dr.requesterId = a.id AND dr.requesterType = 'alumni'
            LEFT JOIN courses c ON dr.courseId = c.id
            LEFT JOIN request_purposes rp ON dr.purposeId = rp.id
            LEFT JOIN request_statuses rs ON dr.statusId = rs.id
            LEFT JOIN pickup_statuses ps ON dr.pickupStatusId = ps.id
            LEFT JOIN request_documents rd ON dr.id = rd.requestId
            LEFT JOIN document_types dt ON rd.documentTypeId = dt.id
        `;

        const params = [];

        if (status) {
            query += ' WHERE rs.statusName = ?';
            params.push(status);
        }

        if (processedBy) {
            const whereClause = status ? ' AND' : ' WHERE';
            query += `${whereClause} dr.processedBy = ?`;
            params.push(processedBy);
        }

        if (department_id) {
            const whereClause = (status || processedBy) ? ' AND' : ' WHERE';
            query += `${whereClause} dr.department_id = ?`;
            params.push(department_id);
        }

        if (programs) {
            const whereClause = (status || processedBy || department_id) ? ' AND' : ' WHERE';
            const placeholders = programs.map(() => '?').join(',');
            query += `${whereClause} c.courseName IN (${placeholders})`;
            params.push(...programs);
        }

        query += ' GROUP BY dr.id ORDER BY dr.createdAt DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        return await this.dbManager.executeQuery(query, params);
    }

    /**
     * Update request status and details
     * @param {number} id - Request ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Updated request data
     */
    async update(id, updateData) {
        const allowedFields = [
            'scheduledPickup',
            'statusId',
            'pickupStatusId',
            'adminNotes',
            'processedBy',
            'dateCompleted',
            'department_id'
        ];

        const updates = [];
        const values = [];

        Object.keys(updateData).forEach(key => {
            if (allowedFields.includes(key) && updateData[key] !== undefined) {
                updates.push(`${key} = ?`);
                values.push(updateData[key]);
            }
        });

        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }

        updates.push('updatedAt = CURRENT_TIMESTAMP');
        values.push(id);

        const query = `UPDATE document_requests SET ${updates.join(', ')} WHERE id = ?`;
        await this.dbManager.executeQuery(query, values);

        return await this.findById(id);
    }

    /**
     * Add document to request
     * @param {number} requestId - Request ID
     * @param {Object} document - Document data
     * @returns {Promise<void>}
     */
    async addDocumentToRequest(requestId, document) {
        const { documentTypeId, quantity, unitPrice } = document;
        const totalPrice = quantity * unitPrice;

        const query = `
            INSERT INTO request_documents
            (requestId, documentTypeId, quantity, unitPrice, totalPrice)
            VALUES (?, ?, ?, ?, ?)
        `;

        await this.dbManager.executeQuery(query, [
            requestId, documentTypeId, quantity, unitPrice, totalPrice
        ]);
    }

    /**
     * Get documents for a request
     * @param {number} requestId - Request ID
     * @returns {Promise<Array>} Array of request documents
     */
    async getRequestDocuments(requestId) {
        const query = `
            SELECT
                dt.documentName as name,
                rd.quantity,
                rd.unitPrice as price,
                rd.totalPrice
            FROM request_documents rd
            JOIN document_types dt ON rd.documentTypeId = dt.id
            WHERE rd.requestId = ?
            ORDER BY dt.documentName ASC
        `;

        return await this.dbManager.executeQuery(query, [requestId]);
    }

    /**
     * Add tracking entry
     * @param {number} requestId - Request ID
     * @param {number} statusId - Status ID
     * @param {string} notes - Tracking notes
     * @param {number} changedBy - User ID who made the change
     * @returns {Promise<void>}
     */
    async addTrackingEntry(requestId, statusId, notes, changedBy = null) {
        const query = `
            INSERT INTO request_tracking (requestId, statusId, changedBy, notes)
            VALUES (?, ?, ?, ?)
        `;

        await this.dbManager.executeQuery(query, [requestId, statusId, changedBy, notes]);
    }

    /**
     * Get tracking history for a request
     * @param {number} requestId - Request ID
     * @returns {Promise<Array>} Array of tracking entries
     */
    async getTrackingHistory(requestId) {
        const query = `
            SELECT
                rt.notes as message,
                rt.createdAt as timestamp,
                rs.statusName as status,
                CONCAT(u.firstName, ' ', u.lastName) as changedBy
            FROM request_tracking rt
            JOIN request_statuses rs ON rt.statusId = rs.id
            LEFT JOIN users u ON rt.changedBy = u.id
            WHERE rt.requestId = ?
            ORDER BY rt.createdAt ASC
        `;

        return await this.dbManager.executeQuery(query, [requestId]);
    }

    /**
     * Get request count
     * @param {Object} filters - Filter options
     * @returns {Promise<number>} Request count
     */
    async count({ status = null, processedBy = null, department_id = null, programs = null } = {}) {
        let query = 'SELECT COUNT(*) as count FROM document_requests dr';
        const params = [];
        let joins = [];
        let whereConditions = [];

        if (programs) {
            joins.push('LEFT JOIN courses c ON dr.courseId = c.id');
        }

        if (status) {
            whereConditions.push('dr.statusId = (SELECT id FROM request_statuses WHERE statusName = ?)');
            params.push(status);
        }

        if (processedBy) {
            whereConditions.push('dr.processedBy = ?');
            params.push(processedBy);
        }

        if (department_id) {
            whereConditions.push('dr.department_id = ?');
            params.push(department_id);
        }

        if (programs) {
            const placeholders = programs.map(() => '?').join(',');
            whereConditions.push(`c.courseName IN (${placeholders})`);
            params.push(...programs);
        }

        if (joins.length > 0) {
            query += ' ' + joins.join(' ');
        }

        if (whereConditions.length > 0) {
            query += ' WHERE ' + whereConditions.join(' AND ');
        }

        const result = await this.dbManager.executeQuery(query, params);
        return result[0].count;
    }

    /**
     * Delete request
     * @param {number} id - Request ID
     * @returns {Promise<boolean>} Success status
     */
    async delete(id) {
        // Check if request exists using a simple query (avoid JOIN issues)
        const checkQuery = 'SELECT id FROM document_requests WHERE id = ?';
        const existingRequest = await this.dbManager.executeQuery(checkQuery, [id]);

        if (existingRequest.length === 0) {
            return false;
        }

        // Delete related records first (cascade delete should handle this, but being explicit)
        // Delete tracking history
        await this.dbManager.executeQuery('DELETE FROM request_tracking WHERE requestId = ?', [id]);

        // Delete request documents
        await this.dbManager.executeQuery('DELETE FROM request_documents WHERE requestId = ?', [id]);

        // Finally delete the main request
        const query = 'DELETE FROM document_requests WHERE id = ?';
        const result = await this.dbManager.executeQuery(query, [id]);
        return result.affectedRows > 0;
    }
}

module.exports = DocumentRequest;
