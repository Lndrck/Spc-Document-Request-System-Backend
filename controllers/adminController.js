const Document = require('../models/Document');
const DocumentRequest = require('../models/DocumentRequest');
const Department = require('../models/Department');
const MailService = require('../services/mailer');

// DB to UI status mapping
const DB_TO_UI_MAP = {
    1: "PENDING",
    2: "PROCESSING",
    3: "READY_FOR_PICKUP",
    4: "RELEASED",
    5: "DECLINE"
};

/**
 * Admin controller - handles admin-specific business logic
 */
class AdminController {
    /**
     * @param {Object} dbManager - Database manager instance
     */
    constructor(dbManager) {
        this.dbManager = dbManager;
        this.documentModel = new Document(dbManager);
        this.documentRequestModel = new DocumentRequest(dbManager);
        this.departmentModel = new Department(dbManager);
    }

    /**
     * Get all documents (admin function)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    getDocuments = async (req, res, next) => {
        try {
            const documents = await this.documentModel.getAll(false); // Get all including inactive

            res.json({
                success: true,
                documents: documents,
                count: documents.length
            });
        } catch (error) {
            console.error('Get documents error:', error);
            next(error);
        }
    };

    /**
     * Add new document (admin function)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    createDocument = async (req, res, next) => {
        try {
            const { name, price, year_options = [], sem_options = [] } = req.body;

            // Validate required fields
            if (!name || !price) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Document name and price are required'
                });
            }

            // Validate price
            const numericPrice = parseFloat(price);
            if (isNaN(numericPrice) || numericPrice < 0) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Price must be a valid positive number'
                });
            }

            // Check if document already exists
            const existingDoc = await this.documentModel.findByName(name);
            if (existingDoc) {
                return res.status(409).json({
                    error: 'Document already exists',
                    message: 'A document with this name already exists'
                });
            }

            // Create new document
            const documentData = {
                documentName: name,
                basePrice: numericPrice,
                isActive: true
            };

            const newDocument = await this.documentModel.create(documentData);

            res.status(201).json({
                success: true,
                message: 'Document added successfully',
                document: newDocument
            });

        } catch (error) {
            console.error('Add document error:', error);
            next(error);
        }
    };

    /**
     * Update document (admin function)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    updateDocument = async (req, res, next) => {
        try {
            const documentId = parseInt(req.params.id);
            const { name, price, year_options = [], sem_options = [] } = req.body;

            if (!documentId || isNaN(documentId)) {
                return res.status(400).json({
                    error: 'Invalid document ID',
                    message: 'Document ID must be a valid number'
                });
            }

            // Validate required fields
            if (!name || !price) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Document name and price are required'
                });
            }

            // Validate price
            const numericPrice = parseFloat(price);
            if (isNaN(numericPrice) || numericPrice < 0) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Price must be a valid positive number'
                });
            }

            // Check if document exists
            const existingDoc = await this.documentModel.findById(documentId);
            if (!existingDoc) {
                return res.status(404).json({
                    error: 'Document not found',
                    message: 'No document found with the provided ID'
                });
            }

            // Check if new name conflicts with existing document
            if (name !== existingDoc.documentName) {
                const nameConflict = await this.documentModel.nameExists(name);
                if (nameConflict) {
                    return res.status(409).json({
                        error: 'Document name already exists',
                        message: 'A document with this name already exists'
                    });
                }
            }

            // Update document
            const updateData = {
                documentName: name,
                basePrice: numericPrice
            };

            const updatedDocument = await this.documentModel.update(documentId, updateData);

            res.json({
                success: true,
                message: 'Document updated successfully',
                document: updatedDocument
            });

        } catch (error) {
            console.error('Update document error:', error);
            next(error);
        }
    };

    /**
     * Delete document (admin function)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    deleteDocument = async (req, res, next) => {
        try {
            const documentId = parseInt(req.params.id);

            if (!documentId || isNaN(documentId)) {
                return res.status(400).json({
                    error: 'Invalid document ID',
                    message: 'Document ID must be a valid number'
                });
            }

            // Check if document exists
            const existingDoc = await this.documentModel.findById(documentId);
            if (!existingDoc) {
                return res.status(404).json({
                    error: 'Document not found',
                    message: 'No document found with the provided ID'
                });
            }

            // Delete document
            await this.documentModel.delete(documentId);

            res.json({
                success: true,
                message: `Document "${existingDoc.documentName}" deleted successfully`
            });

        } catch (error) {
            console.error('Delete document error:', error);
            if (error.message.includes('Cannot delete document')) {
                return res.status(409).json({
                    error: 'Document in use',
                    message: error.message
                });
            }
            next(error);
        }
    };

    /**
     * Get all purposes (admin function)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    getPurposes = async (req, res, next) => {
        try {
            const purposes = await this.dbManager.executeQuery(
                'SELECT id, purposeName as name, isActive, createdAt, updatedAt FROM request_purposes ORDER BY purposeName'
            );

            res.json({
                success: true,
                purposes: purposes,
                count: purposes.length
            });
        } catch (error) {
            console.error('Get purposes error:', error);
            next(error);
        }
    };

    /**
     * Create new purpose (admin function)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    createPurpose = async (req, res, next) => {
        try {
            const { name } = req.body;

            // Validate required fields
            if (!name || !name.trim()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Purpose name is required'
                });
            }

            // Check if purpose already exists
            const existingPurpose = await this.dbManager.executeQuery(
                'SELECT id FROM request_purposes WHERE purposeName = ? AND isActive = TRUE',
                [name.trim()]
            );

            if (existingPurpose.length > 0) {
                return res.status(409).json({
                    error: 'Purpose already exists',
                    message: 'A purpose with this name already exists'
                });
            }

            // Create new purpose
            const result = await this.dbManager.executeQuery(
                'INSERT INTO request_purposes (purposeName) VALUES (?)',
                [name.trim()]
            );

            // Get created purpose
            const newPurpose = await this.dbManager.executeQuery(
                'SELECT id, purposeName as name, isActive, createdAt FROM request_purposes WHERE id = ?',
                [result.insertId]
            );

            res.status(201).json({
                success: true,
                message: 'Purpose created successfully',
                purpose: newPurpose[0]
            });

        } catch (error) {
            console.error('Create purpose error:', error);
            next(error);
        }
    };

    /**
     * Update purpose (admin function)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    updatePurpose = async (req, res, next) => {
        try {
            const purposeId = parseInt(req.params.id);
            const { name } = req.body;

            if (!purposeId || isNaN(purposeId)) {
                return res.status(400).json({
                    error: 'Invalid purpose ID',
                    message: 'Purpose ID must be a valid number'
                });
            }

            // Validate required fields
            if (!name || !name.trim()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Purpose name is required'
                });
            }

            // Check if purpose exists
            const existingPurpose = await this.dbManager.executeQuery(
                'SELECT * FROM request_purposes WHERE id = ?',
                [purposeId]
            );

            if (existingPurpose.length === 0) {
                return res.status(404).json({
                    error: 'Purpose not found',
                    message: 'No purpose found with the provided ID'
                });
            }

            // Check if new name conflicts with existing purpose
            if (name.trim() !== existingPurpose[0].purposeName) {
                const nameConflict = await this.dbManager.executeQuery(
                    'SELECT id FROM request_purposes WHERE purposeName = ? AND id != ? AND isActive = TRUE',
                    [name.trim(), purposeId]
                );

                if (nameConflict.length > 0) {
                    return res.status(409).json({
                        error: 'Purpose name already exists',
                        message: 'A purpose with this name already exists'
                    });
                }
            }

            // Update purpose
            await this.dbManager.executeQuery(
                'UPDATE request_purposes SET purposeName = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
                [name.trim(), purposeId]
            );

            // Get updated purpose
            const updatedPurpose = await this.dbManager.executeQuery(
                'SELECT id, purposeName as name, isActive, createdAt, updatedAt FROM request_purposes WHERE id = ?',
                [purposeId]
            );

            res.json({
                success: true,
                message: 'Purpose updated successfully',
                purpose: updatedPurpose[0]
            });

        } catch (error) {
            console.error('Update purpose error:', error);
            next(error);
        }
    };

    /**
     * Delete purpose (admin function)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    deletePurpose = async (req, res, next) => {
        try {
            const purposeId = parseInt(req.params.id);

            if (!purposeId || isNaN(purposeId)) {
                return res.status(400).json({
                    error: 'Invalid purpose ID',
                    message: 'Purpose ID must be a valid number'
                });
            }

            // Check if purpose exists
            const existingPurpose = await this.dbManager.executeQuery(
                'SELECT purposeName FROM request_purposes WHERE id = ?',
                [purposeId]
            );

            if (existingPurpose.length === 0) {
                return res.status(404).json({
                    error: 'Purpose not found',
                    message: 'No purpose found with the provided ID'
                });
            }

            // Check if purpose is being used in requests
            const purposeInUse = await this.dbManager.executeQuery(
                'SELECT COUNT(*) as count FROM document_requests WHERE purposeId = ?',
                [purposeId]
            );

            if (purposeInUse[0].count > 0) {
                return res.status(409).json({
                    error: 'Purpose in use',
                    message: 'Cannot delete purpose that is being used by existing requests'
                });
            }

            // Soft delete purpose
            await this.dbManager.executeQuery(
                'UPDATE request_purposes SET isActive = FALSE, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
                [purposeId]
            );

            res.json({
                success: true,
                message: `Purpose "${existingPurpose[0].purposeName}" deleted successfully`
            });

        } catch (error) {
            console.error('Delete purpose error:', error);
            next(error);
        }
    };

    /**
     * Get admin statistics
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    getAdminStats = async (req, res, next) => {
        try {
            const user = req.user;

            // Check permissions - only admin can access admin stats
            if (!user || user.role !== 'admin') {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Only admin can access admin statistics'
                });
            }

            // Get all request statuses count
            const allStatusesQuery = `
                SELECT
                    rs.statusName,
                    COUNT(*) as count,
                    SUM(CASE
                        WHEN rs.statusName = 'RELEASED' AND DATE(dr.dateCompleted) = CURDATE() THEN 1
                        WHEN rs.statusName != 'RELEASED' AND DATE(dr.updatedAt) = CURDATE() THEN 1
                        ELSE 0
                    END) as today_count
                FROM document_requests dr
                JOIN request_statuses rs ON dr.statusId = rs.id
                GROUP BY rs.statusName, dr.statusId
                ORDER BY dr.statusId
            `;
            const allStatuses = await this.dbManager.executeQuery(allStatusesQuery);

            // Total requests overall
            const totalRequestsQuery = 'SELECT COUNT(*) as count FROM document_requests';
            const totalRequests = await this.dbManager.executeQuery(totalRequestsQuery);

            // Calculate derived statistics
            const statusMap = {};
            allStatuses.forEach(status => {
                statusMap[status.statusName] = {
                    total: status.count,
                    today: status.today_count
                };
            });

            // Total pending requests
            const totalPending = statusMap.PENDING ? statusMap.PENDING.total : 0;

            // Total processing requests
            const totalProcessing = statusMap.PROCESSING ? statusMap.PROCESSING.total : 0;

            // Total ready for pickup requests
            const totalReadyForPickup = statusMap.READY_FOR_PICKUP ? statusMap.READY_FOR_PICKUP.total : 0;

            // Total released (all RELEASED status documents)
            const totalReleased = statusMap.RELEASED ? statusMap.RELEASED.total : 0;

            // Total decline requests
            const totalDecline = statusMap.DECLINE ? statusMap.DECLINE.total : 0;

            // Total processed today (any status > PENDING updated today)
            const totalProcessedToday = allStatuses.reduce((sum, status) => {
                return sum + (status.statusName !== 'PENDING' ? status.today : 0);
            }, 0);

            // Get document statistics
            const documentStats = await this.dbManager.executeQuery(`
                SELECT
                    COUNT(*) as total_documents,
                    SUM(CASE WHEN isActive = TRUE THEN 1 ELSE 0 END) as active_documents
                FROM document_types
            `);

            // Get requester statistics (student vs alumni requests)
            const studentRequests = await this.dbManager.executeQuery(`
                SELECT COUNT(*) as count FROM document_requests dr
                WHERE dr.requesterType = 'student'
            `);

            const alumniRequests = await this.dbManager.executeQuery(`
                SELECT COUNT(*) as count FROM document_requests dr
                WHERE dr.requesterType = 'alumni'
            `);

            // Get user statistics
            const userStats = await this.dbManager.executeQuery(`
                SELECT
                    COUNT(*) as total_users,
                    SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_users,
                    SUM(CASE WHEN role = 'staff' THEN 1 ELSE 0 END) as staff_users
                FROM users
                WHERE isActive = TRUE
            `);

            const statistics = {
                totalPending: totalPending,
                totalProcessing: totalProcessing,
                totalReadyForPickup: totalReadyForPickup,
                totalReleased: totalReleased,
                totalDecline: totalDecline,
                totalProcessedToday: totalProcessedToday,
                totalRequests: totalRequests[0].count,
                totalStudent: studentRequests[0].count,
                totalAlumni: alumniRequests[0].count,
                completionRate: totalRequests[0].count > 0
                    ? Math.round((totalReleased / totalRequests[0].count) * 100)
                    : 0
            };

            res.json({
                success: true,
                data: statistics
            });

        } catch (error) {
            console.error('Admin statistics error:', error);
            next(error);
        }
    };

    /**
     * Get all document requests with pagination (admin function)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    getAllDocumentRequests = async (req, res, next) => {
        try {
            const { page = 1, limit = 10, status, search } = req.query;
            const { role, department_ids } = req.user;

            const offset = (parseInt(page) - 1) * parseInt(limit);
            const limitNum = parseInt(limit);

            // Build query for document requests using the new requesterId/requesterType structure
            // Include school_year, request_semester, quantity, and document_type
            let query = `
                SELECT
                    dr.id,
                    dr.referenceNumber,
                    dr.scheduledPickup,
                    dr.contactNumber,
                    dr.createdAt as requestedAt,
                    dr.updatedAt,
                    dr.statusId,
                    rs.statusName,
                    dr.purposeId,
                    rp.purposeName,
                    dr.totalAmount,
                    dr.paymentStatus,
                    dr.school_year,
                    dr.request_semester,
                    CASE
                        WHEN dr.requesterType = 'student' THEN s.studentNumber
                        ELSE a.studentNumber
                    END as studentNumber,
                    CASE
                        WHEN dr.requesterType = 'student' THEN s.email
                        ELSE a.email
                    END as email,
                    dr.requesterType,
                    CASE
                        WHEN dr.requesterType = 'student' THEN s.contactNo
                        ELSE a.contactNo
                    END as contactNo,
                    CASE
                        WHEN dr.requesterType = 'student' THEN s.surname
                        ELSE a.surname
                    END as surname,
                    CASE
                        WHEN dr.requesterType = 'student' THEN s.firstName
                        ELSE a.firstName
                    END as firstName,
                    CASE
                        WHEN dr.requesterType = 'student' THEN s.middleInitial
                        ELSE a.middleInitial
                    END as middleInitial,
                    c.courseName as course,
                    d.department_name as courseDepartment,
                    dt.documentName as document_type,
                    SUM(rd.quantity) as quantity
                FROM document_requests dr
                JOIN request_statuses rs ON dr.statusId = rs.id
                LEFT JOIN request_purposes rp ON dr.purposeId = rp.id
                LEFT JOIN students s ON dr.requesterId = s.id AND dr.requesterType = 'student'
                LEFT JOIN alumni a ON dr.requesterId = a.id AND dr.requesterType = 'alumni'
                LEFT JOIN courses c ON dr.courseId = c.id
                LEFT JOIN departments d ON c.department_id = d.department_id
                LEFT JOIN request_documents rd ON dr.id = rd.requestId
                LEFT JOIN document_types dt ON rd.documentTypeId = dt.id
                WHERE 1=1
            `;
            const params = [];

            // RBAC: Role-Based Access Control
            // Staff users can only see requests from their assigned departments
            if (role === 'staff') {
                const userId = req.user.id;

                // Use junction table to ensure server-side authoritative filtering
                query += ` AND c.department_id IN (SELECT department_id FROM user_departments WHERE user_id = ?)`;
                params.push(userId);
                console.log(`🔍 Staff user ${userId} filtering by departments via user_departments`);
            }

            if (status) {
                query += ' AND dr.statusId = ?';
                params.push(parseInt(status));
            }

            if (search) {
                query += ' AND (dr.referenceNumber LIKE ? OR u.firstName LIKE ? OR u.lastName LIKE ? OR u.email LIKE ?)';
                const searchTerm = `%${search}%`;
                params.push(searchTerm, searchTerm, searchTerm, searchTerm);
            }

            query += ' ORDER BY dr.createdAt DESC LIMIT ? OFFSET ?';
            params.push(limitNum, offset);

            const requests = await this.dbManager.executeQuery(query, params);

            // Format scheduledPickup dates
            const formattedRequests = requests.map(request => {
                let formattedDate = null;
                if (request.scheduledPickup) {
                    if (typeof request.scheduledPickup === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(request.scheduledPickup)) {
                        formattedDate = request.scheduledPickup;
                    } else {
                        const d = new Date(request.scheduledPickup);
                        if (!isNaN(d.getTime())) {
                            const year = d.getFullYear();
                            const month = String(d.getMonth() + 1).padStart(2, '0');
                            const day = String(d.getDate()).padStart(2, '0');
                            formattedDate = `${year}-${month}-${day}`;
                        }
                    }
                }
                return {
                    ...request,
                    scheduledPickup: formattedDate
                };
            });

            // Get total count for pagination using the new requesterId/requesterType structure
            let countQuery = `
                SELECT COUNT(*) as total
                FROM document_requests dr
                LEFT JOIN courses c ON dr.courseId = c.id
                WHERE 1=1
            `;
            const countParams = [];

            // Apply same RBAC filter to count query using junction table
            if (role === 'staff') {
                const userId = req.user.id;
                countQuery += ` AND c.department_id IN (SELECT department_id FROM user_departments WHERE user_id = ?)`;
                countParams.push(userId);
            }

            if (status) {
                countQuery += ' AND dr.statusId = ?';
                countParams.push(parseInt(status));
            }

            if (search) {
                countQuery += ' AND (dr.referenceNumber LIKE ? OR u.firstName LIKE ? OR u.lastName LIKE ? OR u.email LIKE ?)';
                const searchTerm = `%${search}%`;
                countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
            }

            const totalResult = await this.dbManager.executeQuery(countQuery, countParams);
            const total = totalResult[0].total;

            res.json({
                success: true,
                requests: formattedRequests,
                pagination: {
                    currentPage: parseInt(page),
                    limit: limitNum,
                    offset: offset,
                    total: total,
                    pages: Math.ceil(total / limitNum),
                    hasNext: offset + limitNum < total,
                    hasPrev: offset > 0
                }
            });

        } catch (error) {
            console.error('Get document requests error:', error);
            next(error);
        }
    };

    /**
     * Get a specific document request by ID with RBAC (role-based access control)
     * Staff users can only access requests from their assigned departments
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    getRequestById = async (req, res, next) => {
        try {
            const requestId = parseInt(req.params.id);
            const { role, department_ids } = req.user;

            if (!requestId || isNaN(requestId)) {
                return res.status(400).json({
                    error: 'Invalid request ID',
                    message: 'Request ID must be a valid number'
                });
            }

            // Base query to fetch the request with course and department info
            let query = `
                SELECT 
                    dr.*,
                    c.id as course_id,
                    c.courseName,
                    c.department_id,
                    d.department_name
                FROM document_requests dr
                LEFT JOIN courses c ON dr.courseId = c.id
                LEFT JOIN departments d ON c.department_id = d.department_id
                WHERE dr.id = ?
            `;
            const results = await this.dbManager.executeQuery(query, [requestId]);
            const request = results[0];

            if (!request) {
                return res.status(404).json({
                    error: 'Request not found',
                    message: 'No request found with the provided ID'
                });
            }

            // RBAC Security Check: If staff, ensure the request belongs to one of their departments
            if (role === 'staff') {
                if (!department_ids || department_ids.length === 0) {
                    console.warn(`🚨 Staff user ${req.user.id} attempted access with no assigned departments`);
                    return res.status(403).json({
                        error: 'Access denied',
                        message: 'You have no assigned departments'
                    });
                }

                // Check if the request's course belongs to any of the staff member's departments
                if (!request.department_id || !department_ids.includes(request.department_id)) {
                    console.warn(`🚨 SECURITY: Staff user ${req.user.id} attempted unauthorized access to request ${requestId} from department ${request.department_id}`);
                    return res.status(403).json({
                        error: 'Unauthorized',
                        message: 'You do not have permission to access requests from other departments'
                    });
                }

                console.log(`✅ Staff user ${req.user.id} accessed request ${requestId} from their department ${request.department_id}`);
            }

            res.json({
                success: true,
                request: request
            });

        } catch (error) {
            console.error('Get request by ID error:', error);
            next(error);
        }
    };

    /**
     * Get all users (admin function)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    getAllUsers = async (req, res, next) => {
        try {
            const { role, limit = 50, offset = 0 } = req.query;

            // Build query for users with department names using GROUP_CONCAT
            let query = `
                SELECT
                    u.id,
                    u.\`firstName\` as first_name,
                    u.\`lastName\` as last_name,
                    u.email,
                    u.role,
                    u.\`isActive\` as status,
                    u.\`lastLogin\` as last_login,
                    GROUP_CONCAT(d.department_name SEPARATOR ', ') as department_name,
                    GROUP_CONCAT(d.department_id SEPARATOR ', ') as department_ids
                FROM users u
                LEFT JOIN user_departments ud ON u.id = ud.user_id
                LEFT JOIN departments d ON ud.department_id = d.department_id
                WHERE u.isActive = TRUE
            `;
            const params = [];

            if (role) {
                query += ' AND u.role = ?';
                params.push(role);
            }

            query += ' GROUP BY u.id ORDER BY u.\`createdAt\` DESC LIMIT ? OFFSET ?';
            params.push(parseInt(limit), parseInt(offset));

            const users = await this.dbManager.executeQuery(query, params);

            // Format the response to include departments array
            const usersWithDepts = users.map(user => {
                let departments = [];
                if (user.department_name && user.department_ids) {
                    const deptNames = user.department_name.split(', ');
                    const deptIds = user.department_ids.split(', ').map(id => parseInt(id));
                    departments = deptNames.map((name, idx) => ({
                        department_id: deptIds[idx],
                        department_name: name
                    }));
                }
        
                return {
                    id: user.id,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    email: user.email,
                    role: user.role,
                    status: user.status,
                    last_login: user.last_login,
                    department_name: user.department_name || 'Not Assigned',
                    departments: departments
                };
            });

            res.json({
                success: true,
                users: usersWithDepts,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: users.length === parseInt(limit)
                }
            });

        } catch (error) {
            console.error('Get users error:', error);
            next(error);
        }
    };

    /**
     * Create new user (admin function)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    createUser = async (req, res, next) => {
        try {
            const { username, email, password, role, firstName, lastName, departments } = req.body;

            // Validate required fields
            if (!username || !email || !role || !firstName || !lastName) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Username, email, role, firstName, and lastName are required'
                });
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Invalid email format'
                });
            }

            // Domain enforcement for user creation
            if (!email.endsWith('@gmail.com')) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Email must be from Gmail domain'
                });
            }

            // Validate role
            if (!['admin', 'staff'].includes(role)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Role must be either admin or staff'
                });
            }

            // Handle departments based on role
            let departmentIds = [];
            if (role === 'staff') {
                // Validate that departments array is provided for staff
                if (!Array.isArray(departments) || departments.length === 0) {
                    console.warn(`⚠️ No departments provided for staff user: ${username}`);
                    return res.status(400).json({
                        error: 'Validation failed',
                        message: 'At least one department is required for staff users'
                    });
                }

                // Process each department
                for (const deptName of departments) {
                    if (!deptName || !deptName.trim()) {
                        continue; // Skip empty department names
                    }

                    const deptTrimmed = deptName.trim();
                    console.log(`🔍 createUser: Looking up department: "${deptTrimmed}"`);

                    // Try direct lookup first
                    const departmentData = await this.departmentModel.findByName(deptTrimmed);

                    if (!departmentData) {
                        // FALLBACK: If direct match fails, try case-insensitive manual match
                        const allDepts = await this.departmentModel.getAll();
                        const fallbackMatch = allDepts.find(d =>
                            d.department_name.toLowerCase().trim() === deptTrimmed.toLowerCase()
                        );

                        if (!fallbackMatch) {
                            console.error(`❌ createUser: Department not found for: "${deptTrimmed}"`);
                            return res.status(400).json({
                                error: 'Validation failed',
                                message: `Invalid department name: "${deptTrimmed}"`
                            });
                        }

                        departmentIds.push(fallbackMatch.department_id);
                        console.log(`✅ createUser: Fallback match found - Department ID: ${fallbackMatch.department_id}`);
                    } else {
                        departmentIds.push(departmentData.department_id);
                        console.log(`✅ createUser: Direct match found - Department ID: ${departmentData.department_id}`);
                    }
                }

                // Ensure at least one valid department was found
                if (departmentIds.length === 0) {
                    return res.status(400).json({
                        error: 'Validation failed',
                        message: 'No valid departments found'
                    });
                }
            }
            // For admin, no departments assigned

            // Check if username already exists
            const existingUsername = await this.dbManager.executeQuery(
                'SELECT id FROM users WHERE username = ? AND isActive = TRUE',
                [username]
            );

            if (existingUsername.length > 0) {
                return res.status(409).json({
                    error: 'Username already exists',
                    message: 'A user with this username already exists'
                });
            }

            // Check if email already exists
            const existingEmail = await this.dbManager.executeQuery(
                'SELECT id FROM users WHERE email = ? AND isActive = TRUE',
                [email]
            );

            if (existingEmail.length > 0) {
                return res.status(409).json({
                    error: 'Email already exists',
                    message: 'A user with this email already exists'
                });
            }

            // Handle password based on role
            let finalPassword = password;
            let tempPassword = null;

            if (role === 'admin') {
                // Generate temporary password for admin
                tempPassword = this.generateTempPassword();
                finalPassword = tempPassword;
                console.log(`🔐 Generated temporary password for admin ${username}: ${tempPassword}`);
            }

            // Hash password
            const hashedPassword = await this.dbManager.hashPassword(finalPassword);

            // Create user (without department_id - now stored in junction table)
            const insertQuery = `
                INSERT INTO users (username, email, password, role, \`firstName\`, \`lastName\`)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            const result = await this.dbManager.executeQuery(insertQuery, [
                username, email, hashedPassword, role, firstName, lastName
            ]);

            const newUserId = result.insertId;

            // Insert department associations for staff users
            if (role === 'staff' && departmentIds.length > 0) {
                for (const deptId of departmentIds) {
                    await this.dbManager.executeQuery(
                        'INSERT INTO user_departments (user_id, department_id) VALUES (?, ?)',
                        [newUserId, deptId]
                    );
                    console.log(`✅ createUser: Linked user ${newUserId} to department ${deptId}`);
                }
            }

            // Get created user with departments
            const newUser = await this.dbManager.executeQuery(`
                SELECT
                    u.id,
                    u.username,
                    u.email,
                    u.role,
                    u.\`firstName\` as firstName,
                    u.\`lastName\` as lastName,
                    u.createdAt
                FROM users u
                WHERE u.id = ?
            `, [newUserId]);

            // Get departments for this user
            let userDepartments = [];
            if (role === 'staff') {
                userDepartments = await this.dbManager.executeQuery(`
                    SELECT d.department_id, d.department_name
                    FROM user_departments ud
                    JOIN departments d ON ud.department_id = d.department_id
                    WHERE ud.user_id = ?
                `, [newUserId]);
            }

            // Log admin credentials (email functionality removed)
            if (role === 'admin' && tempPassword) {
                console.log(`🔐 Admin user created: ${email}`);
                console.log(`   Temporary password: ${tempPassword}`);
                console.log('   Note: Email functionality has been disabled');
            }

            res.status(201).json({
                success: true,
                message: role === 'admin'
                    ? 'Admin user created successfully. Check server logs for login credentials.'
                    : 'User created successfully',
                user: {
                    ...newUser[0],
                    departments: userDepartments
                }
            });

        } catch (error) {
            console.error('Create user error:', error);
            next(error);
        }
    };

    /**
     * Update user (admin function)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    updateUser = async (req, res, next) => {
        try {
            const userId = parseInt(req.params.id);
            const { username, email, role, firstName, lastName, isActive, departments } = req.body;

            if (!userId || isNaN(userId)) {
                return res.status(400).json({
                    error: 'Invalid user ID',
                    message: 'User ID must be a valid number'
                });
            }

            // CRITICAL SECURITY: Explicitly block password updates in non-password endpoints
            if (req.body.password !== undefined) {
                console.warn(`🚨 SECURITY ALERT: Attempted password update via admin updateUser endpoint for user ${userId}. Password updates blocked.`);
                return res.status(400).json({
                    error: 'Invalid operation',
                    message: 'Password updates are not allowed through this endpoint. Use password reset or change password functionality.'
                });
            }

            // Log potential security issues
            const sensitiveFields = ['password', 'reset_token', 'reset_token_expiry'];
            const detectedSensitiveFields = sensitiveFields.filter(field => req.body[field] !== undefined);
            if (detectedSensitiveFields.length > 0) {
                console.warn(`⚠️ WARNING: Sensitive fields detected in updateUser request: ${detectedSensitiveFields.join(', ')}`);
            }

            // Check if user exists
            const existingUser = await this.dbManager.executeQuery(
                'SELECT * FROM users WHERE id = ?',
                [userId]
            );

            if (existingUser.length === 0) {
                return res.status(404).json({
                    error: 'User not found',
                    message: 'No user found with the provided ID'
                });
            }

            // Handle departments based on role
            let departmentIds = [];
            if (role === 'staff') {
                // Validate that departments array is provided for staff
                if (!Array.isArray(departments) || departments.length === 0) {
                    console.warn(`⚠️ No departments provided for staff user: ${userId}`);
                    return res.status(400).json({
                        error: 'Validation failed',
                        message: 'At least one department is required for staff users'
                    });
                }

                // Process each department
                for (const deptName of departments) {
                    if (!deptName || !deptName.trim()) {
                        continue; // Skip empty department names
                    }

                    const deptTrimmed = deptName.trim();
                    console.log(`🔍 updateUser: Looking up department: "${deptTrimmed}"`);

                    // Try direct lookup first
                    const departmentData = await this.departmentModel.findByName(deptTrimmed);

                    if (!departmentData) {
                        // FALLBACK: If direct match fails, try case-insensitive manual match
                        const allDepts = await this.departmentModel.getAll();
                        const fallbackMatch = allDepts.find(d =>
                            d.department_name.toLowerCase().trim() === deptTrimmed.toLowerCase()
                        );

                        if (!fallbackMatch) {
                            console.error(`❌ updateUser: Department not found for: "${deptTrimmed}"`);
                            return res.status(400).json({
                                error: 'Validation failed',
                                message: `Invalid department name: "${deptTrimmed}"`
                            });
                        }

                        departmentIds.push(fallbackMatch.department_id);
                        console.log(`✅ updateUser: Fallback match found - Department ID: ${fallbackMatch.department_id}`);
                    } else {
                        departmentIds.push(departmentData.department_id);
                        console.log(`✅ updateUser: Direct match found - Department ID: ${departmentData.department_id}`);
                    }
                }

                // Ensure at least one valid department was found
                if (departmentIds.length === 0) {
                    return res.status(400).json({
                        error: 'Validation failed',
                        message: 'No valid departments found'
                    });
                }
            }

            // Check if new username conflicts
            if (username && username !== existingUser[0].username) {
                const usernameConflict = await this.dbManager.executeQuery(
                    'SELECT id FROM users WHERE username = ? AND id != ? AND isActive = TRUE',
                    [username, userId]
                );

                if (usernameConflict.length > 0) {
                    return res.status(409).json({
                        error: 'Username already exists',
                        message: 'A user with this username already exists'
                    });
                }
            }

            // Check if new email conflicts and enforce domain
            if (email && email !== existingUser[0].email) {
                // Domain enforcement for email updates
                if (!email.endsWith('@gmail.com')) {
                    return res.status(400).json({
                        error: 'Validation failed',
                        message: 'Email must be from Gmail domain'
                    });
                }

                const emailConflict = await this.dbManager.executeQuery(
                    'SELECT id FROM users WHERE email = ? AND id != ? AND isActive = TRUE',
                    [email, userId]
                );

                if (emailConflict.length > 0) {
                    return res.status(409).json({
                        error: 'Email already exists',
                        message: 'A user with this email already exists'
                    });
                }
            }

            // Build update query
            const updates = [];
            const values = [];

            if (username) {
                updates.push('username = ?');
                values.push(username);
            }

            if (email) {
                updates.push('email = ?');
                values.push(email);
            }

            if (role) {
                updates.push('role = ?');
                values.push(role);
            }

            if (firstName) {
                updates.push('\`firstName\` = ?');
                values.push(firstName);
            }

            if (lastName) {
                updates.push('\`lastName\` = ?');
                values.push(lastName);
            }

            if (isActive !== undefined) {
                updates.push('isActive = ?');
                values.push(isActive);
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    error: 'No updates provided',
                    message: 'At least one field must be provided for update'
                });
            }

            updates.push('updatedAt = CURRENT_TIMESTAMP');
            values.push(userId);

            const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
            await this.dbManager.executeQuery(updateQuery, values);

            // Handle department associations for staff users
            if (role === 'staff' && departmentIds.length > 0) {
                // Delete existing department associations
                await this.dbManager.executeQuery(
                    'DELETE FROM user_departments WHERE user_id = ?',
                    [userId]
                );

                // Insert new department associations
                for (const deptId of departmentIds) {
                    await this.dbManager.executeQuery(
                        'INSERT INTO user_departments (user_id, department_id) VALUES (?, ?)',
                        [userId, deptId]
                    );
                    console.log(`✅ updateUser: Linked user ${userId} to department ${deptId}`);
                }
            } else if (role === 'admin') {
                // Remove all department associations for admin users
                await this.dbManager.executeQuery(
                    'DELETE FROM user_departments WHERE user_id = ?',
                    [userId]
                );
            }

            // Get updated user
            const updatedUser = await this.dbManager.executeQuery(`
                SELECT
                    u.id,
                    u.username,
                    u.email,
                    u.role,
                    u.\`firstName\` as firstName,
                    u.\`lastName\` as lastName,
                    u.\`isActive\` as isActive,
                    u.createdAt,
                    u.updatedAt
                FROM users u
                WHERE u.id = ?
            `, [userId]);

            // Get departments for this user
            let userDepartments = [];
            if (role === 'staff') {
                userDepartments = await this.dbManager.executeQuery(`
                    SELECT d.department_id, d.department_name
                    FROM user_departments ud
                    JOIN departments d ON ud.department_id = d.department_id
                    WHERE ud.user_id = ?
                `, [userId]);
            }

            res.json({
                success: true,
                message: 'User updated successfully',
                user: {
                    ...updatedUser[0],
                    departments: userDepartments
                }
            });

        } catch (error) {
            console.error('Update user error:', error);
            next(error);
        }
    };

    /**
     * Delete user (admin function)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    deleteUser = async (req, res, next) => {
        try {
            const userId = parseInt(req.params.id);

            if (!userId || isNaN(userId)) {
                return res.status(400).json({
                    error: 'Invalid user ID',
                    message: 'User ID must be a valid number'
                });
            }

            // Check if user exists
            const existingUser = await this.dbManager.executeQuery(
                'SELECT username FROM users WHERE id = ?',
                [userId]
            );

            if (existingUser.length === 0) {
                return res.status(404).json({
                    error: 'User not found',
                    message: 'No user found with the provided ID'
                });
            }

            // Prevent admin from deleting themselves
            if (req.user.id === userId) {
                return res.status(400).json({
                    error: 'Invalid operation',
                    message: 'You cannot delete your own account'
                });
            }

            // Deactivate user (soft delete)
            await this.dbManager.executeQuery(
                'UPDATE users SET isActive = FALSE, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
                [userId]
            );

            res.json({
                success: true,
                message: `User "${existingUser[0].username}" deleted successfully`
            });

        } catch (error) {
            console.error('Delete user error:', error);
            next(error);
        }
    };

    /**
     * Update request status and scheduled pickup (admin function)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    updateRequestStatus = async (req, res, next) => {
        try {
            const requestId = parseInt(req.params.id);
            const { statusId: providedStatusId, scheduledPickup } = req.body;
            const user = req.user;
            const { role, department_ids } = req.user;

            console.log(`Received request to update ID=${requestId} with statusId=${providedStatusId}, scheduledPickup=${scheduledPickup}`);

            if (!requestId || isNaN(requestId)) {
                console.log(`Invalid request ID received: ${req.params.id}`);
                return res.status(400).json({ error: 'Invalid ID', message: 'Request ID must be a number' });
            }

            // Check if request exists
            const existingRequest = await this.documentRequestModel.findById(requestId);
            if (!existingRequest) {
                return res.status(404).json({
                    error: 'Request not found',
                    message: 'No request found with the provided ID'
                });
            }

            // RBAC Security Check: If staff, ensure the request belongs to one of their departments
            if (role === 'staff') {
                if (!department_ids || department_ids.length === 0) {
                    console.warn(`🚨 Staff user ${user.id} attempted update with no assigned departments`);
                    return res.status(403).json({
                        error: 'Access denied',
                        message: 'You have no assigned departments'
                    });
                }

                // Fetch the course and department for this request
                const courseQuery = `
                    SELECT c.department_id
                    FROM document_requests dr
                    LEFT JOIN courses c ON dr.courseId = c.id
                    WHERE dr.id = ?
                `;
                const courseResult = await this.dbManager.executeQuery(courseQuery, [requestId]);
                const courseInfo = courseResult[0];

                if (!courseInfo || !courseInfo.department_id || !department_ids.includes(courseInfo.department_id)) {
                    console.warn(`🚨 SECURITY: Staff user ${user.id} attempted unauthorized update to request ${requestId} from department ${courseInfo?.department_id}`);
                    return res.status(403).json({
                        error: 'Unauthorized',
                        message: 'You do not have permission to update requests from other departments'
                    });
                }

                console.log(`✅ Staff user ${user.id} authorized to update request ${requestId}`);
            }

            let statusId = null;
            let dbStatusName = null;

            // Handle status update if provided
            if (providedStatusId !== undefined) {
                statusId = parseInt(providedStatusId);

                // Validate statusId is a valid number
                if (isNaN(statusId)) {
                    return res.status(400).json({
                        error: 'Invalid statusId',
                        message: 'statusId must be a valid number'
                    });
                }

                // Get the database status name from the mapping
                dbStatusName = DB_TO_UI_MAP[statusId];

                // 2. ERROR CATCH: If statusId isn't in the map, it's invalid
                if (!dbStatusName) {
                    console.error(`❌ Invalid statusId: ${statusId} not found in DB_TO_UI_MAP.`);
                    return res.status(400).json({
                        error: 'Invalid statusId',
                        message: `statusId '${statusId}' is not recognized.`
                    });
                }

                // 3. DATABASE CHECK: Verify the status actually exists in the lookup table
                const [statusRow] = await this.dbManager.executeQuery(
                    'SELECT id FROM request_statuses WHERE statusName = ? AND isActive = TRUE',
                    [dbStatusName]
                );

                if (!statusRow) {
                    console.error(`❌ DB Sync Issue: "${dbStatusName}" exists in code but not in 'request_statuses' table.`);
                    return res.status(400).json({
                        error: 'Database error',
                        message: `Status '${dbStatusName}' is not configured in the database.`
                    });
                }

                // Ensure the statusId matches
                if (statusRow.id !== statusId) {
                    console.error(`❌ Status ID mismatch: expected ${statusId}, got ${statusRow.id}`);
                    return res.status(400).json({
                        error: 'Database error',
                        message: 'Status ID mismatch in database.'
                    });
                }
            }

            // Handle scheduledPickup update if provided
            let updateFields = [];
            let updateValues = [];

            if (statusId !== null) {
                updateFields.push('statusId = ?');
                updateValues.push(statusId);
            }

            if (scheduledPickup !== undefined) {
                // Validate date format (YYYY-MM-DD)
                if (scheduledPickup && scheduledPickup.trim() !== '') {
                    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                    if (!dateRegex.test(scheduledPickup)) {
                        return res.status(400).json({
                            error: 'Validation error',
                            message: 'Invalid date format. Use YYYY-MM-DD'
                        });
                    }
                }
                updateFields.push('scheduledPickup = ?');
                updateValues.push(scheduledPickup || null);
            }

            if (updateFields.length === 0) {
                return res.status(400).json({
                    error: 'No updates provided',
                    message: 'At least status or scheduledPickup must be provided'
                });
            }

            // Add updatedAt
            updateFields.push('updatedAt = NOW()');
            updateValues.push(requestId);

            // 4. EXECUTE UPDATE
            const updateQuery = `UPDATE document_requests SET ${updateFields.join(', ')} WHERE id = ?`;
            const updateResult = await this.dbManager.executeQuery(updateQuery, updateValues);

            console.log(`Update result:`, updateResult);

            if (updateResult.affectedRows === 0) {
                console.log(`No rows updated for request ID ${requestId}`);
                return res.status(404).json({
                    error: 'Update failed',
                    message: 'No rows were updated'
                });
            }

            // Handle dateCompleted for RELEASED status
            if (dbStatusName === 'RELEASED') {
                await this.dbManager.executeQuery(
                    'UPDATE document_requests SET dateCompleted = NOW() WHERE id = ?',
                    [requestId]
                );
            }

            console.log(`✅ Success: Request ${requestId} updated by ${user.email}`);

            // =====================================================
            // EMAIL NOTIFICATION: Send email when status changes to READY_FOR_PICKUP
            // =====================================================
            // Check if status changed TO READY_FOR_PICKUP (statusId = 3) from a different status
            const READY_STATUS_ID = 3; // READY_FOR_PICKUP status ID
            
            if (statusId === READY_STATUS_ID && existingRequest.statusId !== READY_STATUS_ID) {
                console.log(`📧 Triggering email notification for Request ${requestId} - Status changed to READY_FOR_PICKUP`);
                
                try {
                    // Fetch student/alumni details and document type for the email
                    const studentQuery = `
                        SELECT 
                            dr.requesterType,
                            CASE 
                                WHEN dr.requesterType = 'student' THEN s.email
                                ELSE a.email
                            END as email,
                            CASE 
                                WHEN dr.requesterType = 'student' THEN CONCAT(s.firstName, ' ', s.surname)
                                ELSE CONCAT(a.firstName, ' ', a.surname)
                            END as fullName,
                            dr.referenceNumber,
                            dr.scheduledPickup,
                            GROUP_CONCAT(DISTINCT dt.documentName SEPARATOR ', ') as documentType
                        FROM document_requests dr
                        LEFT JOIN students s ON dr.requesterId = s.id AND dr.requesterType = 'student'
                        LEFT JOIN alumni a ON dr.requesterId = a.id AND dr.requesterType = 'alumni'
                        LEFT JOIN request_documents rd ON dr.id = rd.requestId
                        LEFT JOIN document_types dt ON rd.documentTypeId = dt.id
                        WHERE dr.id = ?
                        GROUP BY dr.id
                    `;
                    
                    const studentResult = await this.dbManager.executeQuery(studentQuery, [requestId]);
                    const studentData = studentResult[0];
                    
                    if (studentData && studentData.email) {
                        const mailService = new MailService();
                        
                        const emailResult = await mailService.sendReadyForPickupEmail({
                            toEmail: studentData.email,
                            fullName: studentData.fullName,
                            referenceNumber: studentData.referenceNumber,
                            documentType: studentData.documentType || 'Requested Document',
                            scheduledPickup: scheduledPickup || studentData.scheduledPickup
                        });
                        
                        if (emailResult) {
                            console.log(`✅ Email notification sent successfully to ${studentData.email}`);
                        } else {
                            console.warn(`⚠️ Email notification failed for Request ${requestId}`);
                        }
                    } else {
                        console.warn(`⚠️ Could not find student email for Request ${requestId}`);
                    }
                } catch (emailError) {
                    // Log the error but don't fail the status update
                    console.error(`❌ Error sending email notification for Request ${requestId}:`, emailError.message);
                }
            }

            // 5. RETURN STANDARDIZED DATA
            const [updatedRow] = await this.dbManager.executeQuery(
                `SELECT dr.id, dr.statusId, rs.statusName, dr.scheduledPickup, dr.updatedAt
                 FROM document_requests dr
                 LEFT JOIN request_statuses rs ON dr.statusId = rs.id
                 WHERE dr.id = ?`,
                [requestId]
            );

            console.log(`Updated row:`, updatedRow);

            // Map back to UI naming convention before sending to frontend
            updatedRow.status = DB_TO_UI_MAP[updatedRow.statusId] || "UNKNOWN";
            updatedRow.scheduledPickup = updatedRow.scheduledPickup
                ? new Date(updatedRow.scheduledPickup).toISOString().split('T')[0]
                : null;

            res.json({
                success: true,
                message: 'Request updated successfully',
                request: updatedRow
            });

        } catch (error) {
            console.error('Update request error:', error);
            console.log(`Failed to update request ID ${requestId}: ${error.message}`);
            next(error);
        }
    };

    /**
     * Generate temporary password for admin accounts
     * @returns {string} Temporary password
     */
    generateTempPassword() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }
}

module.exports = AdminController;
