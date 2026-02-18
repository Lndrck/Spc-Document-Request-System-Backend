const DocumentRequest = require('../models/DocumentRequest');

// DB to UI status mapping
const DB_TO_UI_MAP = {
    'PENDING': 'PENDING',
    'PROCESSING': 'PROCESSING',
    'READY': 'READY_FOR_PICKUP',
    'RELEASED': 'RELEASED',
    'DECLINE': 'DECLINED'
};

// Export the mapping for use in other modules
module.exports.DB_TO_UI_MAP = DB_TO_UI_MAP;

/**
 * Staff controller - handles staff-specific business logic
 */
class StaffController {
    /**
     * @param {Object} dbManager - Database manager instance
     */
    constructor(dbManager) {
        this.dbManager = dbManager;
        this.documentRequestModel = new DocumentRequest(dbManager);
    }

    /**
     * Update request status and details (staff and admin)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    updateRequest = async (req, res, next) => {
        try {
            const requestId = parseInt(req.params.id);
            const { status, statusId, pickupStatusId, scheduledPickup, adminNotes } = req.body;
            const user = req.user;

            if (!requestId || isNaN(requestId)) {
                return res.status(400).json({
                    error: 'Invalid request ID',
                    message: 'Request ID must be a valid number'
                });
            }

            // Handle status conversion from name to ID
            let actualStatusId = statusId;
            let normalizedStatus = null;
            
            if (status) {
                // Map frontend status values to database status names
                const statusMapping = {
                    'PENDING': 'PENDING',
                    'PROCESSING': 'PROCESSING',
                    'READY_FOR_PICKUP': 'READY',
                    'RELEASED': 'RELEASED',
                    'DECLINED': 'DECLINE'
                };

                const dbStatusName = statusMapping[status.toUpperCase()] || status.toUpperCase().replace(/\s+/g, '_');

                // Convert status name to status ID
                const statusQuery = 'SELECT id FROM request_statuses WHERE statusName = ? AND isActive = TRUE';
                const statusResult = await this.dbManager.executeQuery(statusQuery, [dbStatusName]);
                if (statusResult.length === 0) {
                    return res.status(400).json({
                        error: 'Invalid status',
                        message: `Status '${status}' could not be resolved in the database.`
                    });
                }
                actualStatusId = statusResult[0].id;
                normalizedStatus = dbStatusName; // For later use
            } else if (statusId) {
                // If statusId is provided, get the status name from database
                const statusQuery = 'SELECT statusName FROM request_statuses WHERE id = ? AND isActive = TRUE';
                const statusResult = await this.dbManager.executeQuery(statusQuery, [statusId]);
                if (statusResult.length === 0) {
                    return res.status(400).json({
                        error: 'Invalid status ID',
                        message: `Status ID '${statusId}' could not be resolved in the database.`
                    });
                }
                actualStatusId = statusId;
                normalizedStatus = statusResult[0].statusName;
            }

            // Validate status IDs if provided
            if (actualStatusId !== undefined) {
                const validStatuses = await this.dbManager.executeQuery(
                    'SELECT id FROM request_statuses WHERE id = ?',
                    [actualStatusId]
                );
                if (validStatuses.length === 0) {
                    return res.status(400).json({
                        error: 'Invalid status ID',
                        message: 'The provided status ID does not exist'
                    });
                }
            }

            if (pickupStatusId !== undefined) {
                const validPickupStatuses = await this.dbManager.executeQuery(
                    'SELECT id FROM pickup_statuses WHERE id = ?',
                    [pickupStatusId]
                );
                if (validPickupStatuses.length === 0) {
                    return res.status(400).json({
                        error: 'Invalid pickup status ID',
                        message: 'The provided pickup status ID does not exist'
                    });
                }
            }

            // Build update data
            const updateData = {};

            if (actualStatusId !== undefined && actualStatusId !== null) {
                updateData.statusId = actualStatusId;
            }

            if (pickupStatusId !== undefined) {
                updateData.pickupStatusId = pickupStatusId;
            }

            if (scheduledPickup !== undefined && scheduledPickup !== null) {
                updateData.scheduledPickup = scheduledPickup;
            }

            if (adminNotes !== undefined) {
                updateData.adminNotes = adminNotes;
            }

            if (Object.keys(updateData).length === 0) {
                return res.status(400).json({
                    error: 'No updates provided',
                    message: 'At least one field must be provided for update'
                });
            }

            // Check if request exists
            const existingRequest = await this.documentRequestModel.findById(requestId);
            if (!existingRequest) {
                return res.status(404).json({
                    error: 'Request not found',
                    message: 'No request found with the provided ID'
                });
            }

            // Update processedBy field if this is a staff member updating the request
            if (user.role === 'staff' && actualStatusId) {
                updateData.processedBy = user.id;
            }

            // Handle optional dateCompleted logic for RELEASED status
            if (status && normalizedStatus === 'RELEASED') {
                updateData.dateCompleted = new Date();
            }

            // Update the request
            const updatedRequest = await this.documentRequestModel.update(requestId, updateData);

            if (!updatedRequest) {
                return res.status(404).json({
                    error: 'Request not found',
                    message: 'No request found with the provided ID'
                });
            }

            // Map database status name back to UI status name if present
            if (updatedRequest.statusName) {
                updatedRequest.statusName = DB_TO_UI_MAP[updatedRequest.statusName];
                if (!updatedRequest.statusName) {
                    return res.status(400).json({
                        error: 'Status mapping error',
                        message: 'Unable to map database status to UI status'
                    });
                }
            }

            // Add tracking entry for the update
            const trackingNotes = `Request updated by ${user.role} (${user.firstName} ${user.lastName})`;
            await this.documentRequestModel.addTrackingEntry(
                requestId,
                actualStatusId || 1, // Default to PENDING if no status provided
                trackingNotes,
                user.id
            );

            // === Send ready-for-pickup email if status is READY ===
            try {
                const dbStatusNameCandidate = normalizedStatus || updatedRequest.status || updatedRequest.statusName;
                const dbStatusNameUpper = String(dbStatusNameCandidate || '').toUpperCase();
                const isReady = dbStatusNameUpper === 'READY' || dbStatusNameUpper === 'READY_FOR_PICKUP';

                console.log('StaffController: READY detection', { normalizedStatus, status_from_model: updatedRequest.status, status_ui: updatedRequest.statusName, candidate: dbStatusNameCandidate, isReady });

                if (isReady) {
                    const mailService = req.mailService || req.app?.locals?.mailService;
                    if (mailService && typeof mailService.sendReadyForPickupEmail === 'function') {
                        // Re-fetch full request details to ensure correct requester info
                        const fullRequest = await this.documentRequestModel.findById(requestId);
                        const toEmail = fullRequest?.email;
                        const fullName = `${fullRequest?.firstName || ''} ${fullRequest?.surname || ''}`.trim();

                        if (toEmail && fullName) {
                            const docs = await this.documentRequestModel.getRequestDocuments(requestId);
                            const documentType = docs.length ? docs.map(d => d.name).join(', ') : 'Document';

                            const emailData = {
                                toEmail,
                                fullName,
                                referenceNumber: fullRequest.referenceNumber,
                                documentType,
                                scheduledPickup: fullRequest.scheduledPickup
                            };

                            try {
                                await mailService.sendReadyForPickupEmail(emailData);
                                console.log(`✅ Ready-for-pickup email sent to ${toEmail} for request ${requestId}`);
                            } catch (mailErr) {
                                console.error('Error sending ready-for-pickup email:', mailErr);
                            }
                        } else {
                            console.warn('Skipping ready-for-pickup email: missing recipient info', { toEmail, fullName });
                        }
                    } else {
                        console.warn('mailService not available or does not implement sendReadyForPickupEmail', { hasMailService: !!(req.mailService || req.app?.locals?.mailService) });
                    }
                }
            } catch (err) {
                console.error('Error while attempting to send ready-for-pickup email in staffController:', err);
            }

            res.json({
                success: true,
                message: 'Request updated successfully',
                request: updatedRequest
            });

        } catch (error) {
            console.error('Request update error:', error);
            next(error);
        }
    };

    /**
     * Update request scheduled pickup date only (staff and admin)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    updateRequestSchedule = async (req, res, next) => {
        try {
            const requestId = parseInt(req.params.id);
            const { scheduled_pickup } = req.body;
            const user = req.user;

            if (!requestId || isNaN(requestId)) {
                return res.status(400).json({
                    error: 'Invalid request ID',
                    message: 'Request ID must be a valid number'
                });
            }

            // Validate that scheduled_pickup is provided
            if (scheduled_pickup === undefined || scheduled_pickup === null) {
                return res.status(400).json({
                    error: 'Missing scheduled pickup date',
                    message: 'scheduled_pickup field is required'
                });
            }

            // Validate date format (YYYY-MM-DD)
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(scheduled_pickup)) {
                return res.status(400).json({
                    error: 'Invalid date format',
                    message: 'scheduled_pickup must be in YYYY-MM-DD format'
                });
            }

            // Validate that the date is not in the past
            const pickupDate = new Date(scheduled_pickup);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (pickupDate < today) {
                return res.status(400).json({
                    error: 'Invalid pickup date',
                    message: 'Scheduled pickup date cannot be in the past'
                });
            }

            // Check if request exists
            const existingRequest = await this.documentRequestModel.findById(requestId);
            if (!existingRequest) {
                return res.status(404).json({
                    error: 'Request not found',
                    message: 'No request found with the provided ID'
                });
            }

            // Use the date directly (already in YYYY-MM-DD format for DATE column)
            const updateData = {
                scheduledPickup: scheduled_pickup
            };

            // Update processedBy field if this is a staff member
            if (user.role === 'staff') {
                updateData.processedBy = user.id;
            }

            // Update the request
            const updatedRequest = await this.documentRequestModel.update(requestId, updateData);

            if (!updatedRequest) {
                return res.status(404).json({
                    error: 'Request not found',
                    message: 'No request found with the provided ID'
                });
            }

            // Add tracking entry for the schedule update
            const trackingNotes = `Pickup schedule updated by ${user.role} (${user.firstName} ${user.lastName}) to ${scheduled_pickup}`;
            await this.documentRequestModel.addTrackingEntry(
                requestId,
                existingRequest.statusId || 1, // Use current status or default to PENDING
                trackingNotes,
                user.id
            );

            res.json({
                success: true,
                message: 'Pickup schedule updated successfully',
                request: updatedRequest,
                scheduled_pickup: scheduled_pickup
            });

        } catch (error) {
            console.error('Schedule update error:', error);
            next(error);
        }
    };

    /**
     * Get staff statistics
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    getStaffStats = async (req, res, next) => {
        try {
            const user = req.user;

            // Check permissions - only staff can access staff stats
            if (!user || user.role !== 'staff') {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Only staff can access staff statistics'
                });
            }

            // Get today's date for filtering
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

            // Get assigned department IDs from junction table
            const deptQuery = 'SELECT department_id FROM user_departments WHERE user_id = ?';
            const deptResults = await this.dbManager.executeQuery(deptQuery, [user.id]);
            const assignedDeptIds = deptResults.map(d => d.department_id);

            // Guard: if no departments assigned, return empty stats
            if (assignedDeptIds.length === 0) {
                return res.json({
                    success: true,
                    data: {
                        myPendingRequests: 0,
                        myProcessingRequests: 0,
                        myReleasedDocuments: 0,
                        myReadyForPickup: 0,
                        myCompletionRate: 0,
                        totalProcessedByStaff: 0
                    }
                });
            }

            const deptPlaceholders = assignedDeptIds.map(() => '?').join(',');
            const deptParams = assignedDeptIds;

            // Staff's pending requests (from their assigned departments)
            const myPendingQuery = `
                SELECT COUNT(*) as count FROM document_requests dr
                JOIN request_statuses rs ON dr.statusId = rs.id
                JOIN courses c ON dr.courseId = c.id
                WHERE rs.statusName = 'PENDING' AND rs.isActive = TRUE AND c.department_id IN (${deptPlaceholders})
            `;
            const myPending = await this.dbManager.executeQuery(myPendingQuery, deptParams);

            // Staff's released documents
            const myReleasedQuery = `
                SELECT COUNT(*) as count FROM document_requests dr
                JOIN request_statuses rs ON dr.statusId = rs.id
                JOIN courses c ON dr.courseId = c.id
                WHERE rs.statusName = 'RELEASED' AND rs.isActive = TRUE AND c.department_id IN (${deptPlaceholders})
            `;
            const myReleased = await this.dbManager.executeQuery(myReleasedQuery, deptParams);

            // Staff's processing requests
            const myProcessingQuery = `
                SELECT COUNT(*) as count FROM document_requests dr
                JOIN request_statuses rs ON dr.statusId = rs.id
                JOIN courses c ON dr.courseId = c.id
                WHERE rs.statusName = 'PROCESSING' AND rs.isActive = TRUE AND c.department_id IN (${deptPlaceholders})
            `;
            const myProcessing = await this.dbManager.executeQuery(myProcessingQuery, deptParams);

            // Staff's ready for pickup requests
            const myReadyForPickupQuery = `
                SELECT COUNT(*) as count FROM document_requests dr
                JOIN request_statuses rs ON dr.statusId = rs.id
                JOIN courses c ON dr.courseId = c.id
                WHERE rs.statusName = 'READY' AND rs.isActive = TRUE AND c.department_id IN (${deptPlaceholders})
            `;
            const myReadyForPickup = await this.dbManager.executeQuery(myReadyForPickupQuery, deptParams);

            // Staff's total processed requests (all non-pending)
            const myTotalProcessedQuery = `
                SELECT COUNT(*) as count FROM document_requests dr
                JOIN request_statuses rs ON dr.statusId = rs.id
                JOIN courses c ON dr.courseId = c.id
                WHERE rs.statusName IN ('PROCESSING', 'READY', 'RELEASED', 'DECLINE')
                  AND rs.isActive = TRUE AND c.department_id IN (${deptPlaceholders})
            `;
            const myTotalProcessed = await this.dbManager.executeQuery(myTotalProcessedQuery, deptParams);

            // Calculate completion rate
            const completionRate = myTotalProcessed[0].count > 0
                ? Math.round((myReleased[0].count / myTotalProcessed[0].count) * 100)
                : 0;

            const statistics = {
                myPendingRequests: myPending[0].count,
                myProcessingRequests: myProcessing[0].count,
                myReleasedDocuments: myReleased[0].count,
                myReadyForPickup: myReadyForPickup[0].count,
                myCompletionRate: completionRate,
                totalProcessedByStaff: myTotalProcessed[0].count
            };

            res.json({
                success: true,
                data: statistics
            });

        } catch (error) {
            console.error('Staff statistics error:', error);
            next(error);
        }
    };

    /**
     * Get staff's assigned requests (filtered by department)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    getMyRequests = async (req, res, next) => {
        try {
            const user = req.user;
            console.log('getMyRequests - User:', user);
            const { status, limit = 50, offset = 0 } = req.query;

            if (!user || user.role !== 'staff') {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Only staff can access their requests'
                });
            }

            // Get assigned department IDs from junction table
            const deptQuery = 'SELECT department_id FROM user_departments WHERE user_id = ?';
            const deptResults = await this.dbManager.executeQuery(deptQuery, [user.id]);
            const assignedDeptIds = deptResults.map(d => d.department_id);
            console.log('getMyRequests - Assigned departments:', assignedDeptIds);

            if (assignedDeptIds.length === 0) {
                console.log('No departments assigned to staff user');
                return res.json({
                    success: true,
                    requests: [],
                    pagination: {
                        limit: parseInt(limit),
                        offset: parseInt(offset),
                        hasMore: false
                    }
                });
            }

            const deptPlaceholders = assignedDeptIds.map(() => '?').join(',');

            // Build query to get requests filtered by staff's department programs
            // Include school_year, request_semester, quantity, and document_type
            // Use GROUP BY dr.id to avoid duplicate rows when a request has multiple documents
            // Use GROUP_CONCAT with pipe separator for document names and quantities
            let query = `
                SELECT
                    dr.id,
                    dr.referenceNumber,
                    dr.contactNumber,
                    dr.scheduledPickup,
                    dr.createdAt as requestedAt,
                    dr.updatedAt,
                    dr.statusId,
                    rs.statusName,
                    dr.purposeId,
                    rp.purposeName,
                    dr.totalAmount,
                    dr.school_year,
                    dr.request_semester,
                    dr.requesterType,
                    c.courseName as course,
                    c.educationalLevel,
                    d.department_name,
                    CASE
                        WHEN dr.requesterType = 'student' THEN s.studentNumber
                        ELSE 'N/A'
                    END as studentNumber,
                    CASE
                        WHEN dr.requesterType = 'student' THEN s.email
                        ELSE a.email
                    END as email,
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
                    GROUP_CONCAT(DISTINCT dt.documentName ORDER BY dt.id SEPARATOR ' | ') as document_list,
                    GROUP_CONCAT(rd.quantity ORDER BY dt.id SEPARATOR ' | ') as quantity_list
                FROM document_requests dr
                JOIN request_statuses rs ON dr.statusId = rs.id
                LEFT JOIN request_purposes rp ON dr.purposeId = rp.id
                LEFT JOIN students s ON dr.requesterId = s.id AND dr.requesterType = 'student'
                LEFT JOIN alumni a ON dr.requesterId = a.id AND dr.requesterType = 'alumni'
                LEFT JOIN courses c ON dr.courseId = c.id
                LEFT JOIN departments d ON c.department_id = d.department_id
                LEFT JOIN request_documents rd ON dr.id = rd.requestId
                LEFT JOIN document_types dt ON rd.documentTypeId = dt.id
                WHERE c.department_id IN (${deptPlaceholders})
                GROUP BY dr.id
            `;

            const params = [...assignedDeptIds];

            if (status) {
                query += ' AND dr.statusId = ?';
                params.push(parseInt(status));
            }

            query += ' ORDER BY dr.createdAt DESC LIMIT ? OFFSET ?';
            params.push(parseInt(limit), parseInt(offset));

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

            // For each request, get the associated documents
            const requestsWithDocuments = await Promise.all(
                formattedRequests.map(async (request) => {
                    const documents = await this.documentRequestModel.getRequestDocuments(request.id);
                    return {
                        ...request,
                        documents: documents
                    };
                })
            );

            res.json({
                success: true,
                requests: requestsWithDocuments,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: requestsWithDocuments.length === parseInt(limit)
                }
            });

        } catch (error) {
            console.error('Get staff requests error:', error);
            next(error);
        }
    };

    /**
     * Get staff dashboard data
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    getDashboard = async (req, res, next) => {
        try {
            const user = req.user;

            if (!user || user.role !== 'staff') {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Only staff can access staff dashboard'
                });
            }

            // Get assigned department IDs and names from junction table
            const deptQuery = `
                SELECT d.department_id, d.department_name
                FROM user_departments ud
                JOIN departments d ON ud.department_id = d.department_id
                WHERE ud.user_id = ?
            `;
            const deptResults = await this.dbManager.executeQuery(deptQuery, [user.id]);
            const assignedDeptIds = deptResults.map(d => d.department_id);
            const departmentNames = deptResults.map(d => d.department_name).join(', ') || 'Not Assigned';

            // Guard: if no departments assigned, return empty dashboard
            if (assignedDeptIds.length === 0) {
                return res.json({
                    success: true,
                    dashboard: {
                        staffInfo: {
                            id: user.id,
                            name: `${user.firstName} ${user.lastName}`,
                            role: user.role,
                            departments: departmentNames
                        },
                        stats: {
                            pendingRequests: 0,
                            completedToday: 0,
                            recentRequests: 0
                        },
                        recentRequests: []
                    }
                });
            }

            const placeholders = assignedDeptIds.map(() => '?').join(',');

            // Get recent requests from staff's assigned departments
            const recentRequestsQuery = `
                SELECT
                    dr.id,
                    dr.referenceNumber,
                    dr.scheduledPickup,
                    dr.createdAt,
                    rs.statusName,
                    c.courseName as course,
                    d.department_name
                FROM document_requests dr
                JOIN request_statuses rs ON dr.statusId = rs.id
                JOIN courses c ON dr.courseId = c.id
                JOIN departments d ON c.department_id = d.department_id
                WHERE c.department_id IN (${placeholders})
                ORDER BY dr.createdAt DESC
                LIMIT 10
            `;
            const recentRequests = await this.dbManager.executeQuery(recentRequestsQuery, assignedDeptIds);

            // Get pending requests count from staff's assigned departments
            const pendingCount = await this.dbManager.executeQuery(`
                SELECT COUNT(*) as count FROM document_requests dr
                JOIN request_statuses rs ON dr.statusId = rs.id
                JOIN courses c ON dr.courseId = c.id
                WHERE rs.statusName = 'PENDING' AND rs.isActive = TRUE AND c.department_id IN (${placeholders})
            `, assignedDeptIds);

            // Get today's released requests from staff's assigned departments
            const todayCompleted = await this.dbManager.executeQuery(`
                SELECT COUNT(*) as count FROM document_requests dr
                JOIN request_statuses rs ON dr.statusId = rs.id
                JOIN courses c ON dr.courseId = c.id
                WHERE rs.statusName = 'RELEASED' AND rs.isActive = TRUE AND DATE(dr.updatedAt) = CURDATE() AND c.department_id IN (${placeholders})
            `, assignedDeptIds);

            res.json({
                success: true,
                dashboard: {
                    staffInfo: {
                        id: user.id,
                        name: `${user.firstName} ${user.lastName}`,
                        role: user.role,
                        departments: departmentNames
                    },
                    stats: {
                        pendingRequests: pendingCount[0].count,
                        completedToday: todayCompleted[0].count,
                        recentRequests: recentRequests.length
                    },
                    recentRequests: recentRequests.slice(0, 5) // Last 5 requests
                }
            });

        } catch (error) {
            console.error('Staff dashboard error:', error);
            next(error);
        }
    };

    /**
     * Delete request (staff can only delete requests from their assigned departments)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    deleteRequest = async (req, res, next) => {
        try {
            const user = req.user;
            const requestId = parseInt(req.params.id);

            if (!user || user.role !== 'staff') {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Only staff can delete requests'
                });
            }

            if (!requestId || isNaN(requestId)) {
                return res.status(400).json({
                    error: 'Invalid request ID',
                    message: 'Request ID must be a valid number'
                });
            }

            // Get staff's assigned department IDs
            const deptQuery = 'SELECT department_id FROM user_departments WHERE user_id = ?';
            const deptResults = await this.dbManager.executeQuery(deptQuery, [user.id]);
            const assignedDeptIds = deptResults.map(d => d.department_id);

            if (assignedDeptIds.length === 0) {
                return res.status(403).json({
                    error: 'No departments assigned',
                    message: 'You are not assigned to any department'
                });
            }

            const deptPlaceholders = assignedDeptIds.map(() => '?').join(',');

            // Check if the request belongs to one of the staff's assigned departments
            const checkQuery = `
                SELECT dr.id 
                FROM document_requests dr
                JOIN courses c ON dr.courseId = c.id
                WHERE dr.id = ? AND c.department_id IN (${deptPlaceholders})
                LIMIT 1
            `;
            const checkParams = [requestId, ...assignedDeptIds];
            const checkResult = await this.dbManager.executeQuery(checkQuery, checkParams);

            if (checkResult.length === 0) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'You can only delete requests from your assigned departments'
                });
            }

            // Delete the request
            const [result] = await this.dbManager.executeQuery(
                'DELETE FROM document_requests WHERE id = ?',
                [requestId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Request not found'
                });
            }

            return res.json({
                success: true,
                message: 'Request deleted successfully'
            });

        } catch (error) {
            console.error('Delete request error:', error);
            next(error);
        }
    }
}

module.exports = StaffController;
