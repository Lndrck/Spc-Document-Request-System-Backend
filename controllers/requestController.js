const DocumentRequest = require('../models/DocumentRequest');

/**
 * Utility function for input sanitization
 * @param {*} input - Input value to sanitize
 * @returns {*} Sanitized input
 */
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input.trim();
  }
  return input;
};

/**
 * Validate student request data
 * @param {Object} data - Request data
 * @returns {Array} Array of validation error messages
 */
const validateStudentRequest = (data) => {
  const errors = [];

  if (!data.studentNumber) {
    errors.push('Student number is required');
  }

  if (!data.spcEmail) {
    errors.push('Email is required');
  }

  if (!data.documents || data.documents.length === 0) {
    errors.push('At least one document must be requested');
  }

  return errors;
};

/**
 * Validate alumni request data
 * @param {Object} data - Request data
 * @returns {Array} Array of validation error messages
 */
const validateAlumniRequest = (data) => {
  const errors = [];

  if (!data.spcEmail) {
    errors.push('SPC email is required');
  }

  // School year and semester are provided at the document card level, not at form level
  // These will be NULL in document_requests for alumni, which is allowed after migration

  if (!data.documents || data.documents.length === 0) {
    errors.push('At least one document must be requested');
  }

  return errors;
};

/**
 * Document Request controller - handles document request-related business logic
 */
class RequestController {
    /**
     * @param {Object} dbManager - Database manager instance
     */
    constructor(dbManager) {
        this.dbManager = dbManager;
        this.documentRequestModel = new DocumentRequest(dbManager);

        // Program to department mapping
        this.programToDepartment = {
            // College of Arts and Sciences
            'BA Comm': 'College of Arts and Sciences',
            'ABEL': 'College of Arts and Sciences',
            'AB PolSci': 'College of Arts and Sciences',
            'BS Mathematics': 'College of Arts and Sciences',
            'BS Psych': 'College of Arts and Sciences',

            // College of Business Management
            'BSBA': 'College of Business Management',
            'BS Entrep': 'College of Business Management',
            'BS PubAd': 'College of Business Management',
            'BSREM': 'College of Business Management',
            'BSHM': 'College of Business Management',

            // College of Education
            'BEED': 'College of Education',
            'BSED': 'College of Education',
            'BTLEd': 'College of Education',
            'BPED': 'College of Education',
            'BSNEd': 'College of Education',
            'CTP': 'College of Education',
            'BECEd': 'College of Education',

            // Graduate School (Master's and Doctoral programs)
            'M.A. Engl.': 'Graduate School',
            'M.A. Fil.': 'Graduate School',
            'M.A.C': 'Graduate School',
            'MBA': 'Graduate School',
            'DBA': 'Graduate School',
            'MAEM': 'Graduate School',
            'Ed.D': 'Graduate School',
            'Ph.D': 'Graduate School',
            'M.Ed': 'Graduate School',
            'M.S.': 'Graduate School',
            'M.S.Ed': 'Graduate School',
            'MAN': 'Graduate School',
          
            // College of Nursing
            'BSN': 'College of Nursing',
            

            // College of Computer Studies
            'BSCS': 'College of Computer Studies',
            'BSIT': 'College of Computer Studies',
            'ACT': 'College of Computer Studies',

            // College of Physical Therapy
            'BSPT': 'College of Physical Therapy',

            // College of Radiologic Technology
            'BSRT': 'College of Radiologic Technology',
            'AradTech': 'College of Radiologic Technology',

            // College of Accountancy
            'BSA': 'College of Accountancy',

            // College of Law
            'J.D': 'College of Law',

            // Senior High School (no specific department)
            'Academic Track': null,
            'GAS': null,
            'ABM': null,
            'STEM': null,
            'HUMSS': null
        };
    }

    /**
     * Generate unique request ID
     * @returns {string} Unique request ID
     */
    generateRequestId() {
        return 'REQ-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    }

    /**
     * Determine department for student based on educational level
     * K-10: Route by educational level (no course needed)
     * Grade 11+: Route by course's department_id
     * @param {Object} requestData - Request data
     * @param {number|null} courseId - Course ID
     * @returns {Promise<Object|null>} Object with department_id or null
     */
    async getDepartmentForStudent(requestData, courseId = null) {
        const educationalLevel = requestData.educationalLevel;
        
        // Helper function to get department by name (with newline handling)
        const getDepartmentByName = async (name) => {
            if (!name) return null;
            
            // Handle department names with trailing \r\n
            const cleanName = name.replace(/\r\n$/, '').trim();
            
            const existing = await this.dbManager.executeQuery(
                `SELECT department_id FROM departments 
                 WHERE LOWER(TRIM(department_name)) = LOWER(TRIM(?)) 
                 LIMIT 1`,
                [cleanName]
            );
            
            if (existing.length > 0) {
                return { department_id: existing[0].department_id };
            }
            return null;
        };
        
        // K-10: Route by educational level directly
        const normalizedLevel = requestData.educationalLevel?.toLowerCase().trim();
        console.log(`Routing student with educationalLevel: "${requestData.educationalLevel}" (normalized: "${normalizedLevel}")`);
        
        if (normalizedLevel === 'basic education') {
            // Kinder → Basic Education Department
            return await getDepartmentByName('Basic Education Department');
        }
        
        if (normalizedLevel === 'elementary') {
            // Grade 1-6 → Grade School Department
            return await getDepartmentByName('Grade School Department');
        }
        
        if (normalizedLevel === 'high school') {
            // Grade 7-10 → Junior High School Department
            return await getDepartmentByName('Junior High School Department');
        }
        
        // Grade 11+: Route by course's department_id
        if (courseId) {
            console.log(`Routing Grade 11+ student by course's department`);
            
            const course = await this.dbManager.executeQuery(
                `SELECT c.id, c.courseName, c.department_id, d.department_name 
                 FROM courses c 
                 LEFT JOIN departments d ON c.department_id = d.department_id 
                 WHERE c.id = ? LIMIT 1`,
                [courseId]
            );
            
            if (course.length > 0 && course[0].department_id) {
                console.log(`Course "${course[0].courseName}" has department_id: ${course[0].department_id} (${course[0].department_name})`);
                return { department_id: course[0].department_id };
            }
            
            // Fallback to programToDepartment mapping if course has no department_id
            const programMapping = this.programToDepartment[requestData.course?.trim()];
            if (programMapping) {
                console.log(`Using programToDepartment mapping: ${requestData.course} -> ${programMapping}`);
                return await getDepartmentByName(programMapping);
            }
        }
        
        // Final fallback: use collegeDepartment from request
        console.log('Using fallback: collegeDepartment from request');
        return await getDepartmentByName(requestData.collegeDepartment);
    }

    /**
     * Generate unique request number
     * @returns {string} Unique request number
     */
    generateRequestNo() {
        return 'RN-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    }

    /**
     * Generate unique reference number
     * @returns {Promise<string>} Unique reference number
     */
    async generateUniqueReferenceNumber() {
        return 'REF-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    }

    /**
     * Validate client's tempReferenceNumber and use it if valid
     * Ensures the format SPC-DOC-XXXXXX-XXXX is maintained
     * @param {string} tempRef - Temporary reference number from client
     * @returns {boolean} Whether to use the temp reference
     */
    validateAndUseTempReference(tempRef) {
        console.log('=== VALIDATE REFERENCE NUMBER DEBUG ===');
        console.log('tempRef received:', tempRef);
        console.log('typeof tempRef:', typeof tempRef);
        console.log('tempRef is string:', typeof tempRef === 'string');
        
        // Validate format: SPC-DOC-XXXXXX-XXXX (6-digit sequence + 4-digit sequence)
        const spcDocFormatRegex = /^SPC-DOC-\d{6}-\d{4}$/;
        console.log('Regex test result:', spcDocFormatRegex.test(tempRef));
        
        if (tempRef && typeof tempRef === 'string' && spcDocFormatRegex.test(tempRef)) {
            console.log('✅ Using client-provided reference number:', tempRef);
            return true;
        }
        
        console.log('❌ Invalid or missing tempReferenceNumber, generating new one');
        console.log('=== END VALIDATE REFERENCE NUMBER DEBUG ===');
        return false;
    }

    /**
     * Check request protections (Layer 1-3)
     * @param {string} requesterType - 'student' or 'alumni'
     * @param {string} email - Requester email
     * @param {string} purpose - Purpose of request
     * @param {Array} documents - Array of documents
     * @returns {Promise<string|null>} Error message or null if no violations
     */
    async checkRequestProtections(requesterType, requesterId, purpose, documents) {
        // Layer 1: Check for duplicate pending requests
        const duplicateCheck = await this.checkDuplicatePendingRequest(requesterType, requesterId, purpose, documents);
        if (duplicateCheck) {
            return duplicateCheck;
        }

        // Layer 2: Check cooldown period
        const cooldownCheck = await this.checkRequestCooldown(requesterType, requesterId);
        if (cooldownCheck) {
            return cooldownCheck;
        }

        // Layer 3: Check max pending requests
        const maxPendingCheck = await this.checkMaxPendingRequests(requesterType, requesterId);
        if (maxPendingCheck) {
            return maxPendingCheck;
        }

        return null;
    }

    /**
     * Layer 1 Protection: Check for duplicate pending requests
     * @param {string} requesterType - 'student' or 'alumni'
     * @param {string} email - Requester email
     * @param {string} purpose - Purpose of request
     * @param {Array} documents - Array of documents
     * @returns {Promise<string|null>} Error message or null if no duplicate
     */
    async checkDuplicatePendingRequest(requesterType, requesterId, purpose, documents) {
        // Get selected document names
        const selectedDocs = documents
            .filter(doc => doc.checked && doc.quantity > 0)
            .map(doc => doc.name);

        // Fix: Generate proper placeholders for IN clause
        const placeholders = selectedDocs.map(() => '?').join(', ');

        // Check if there's already a pending request with same requesterId, purpose, and documents
        const query = `
            SELECT COUNT(*) as count
            FROM document_requests dr
            JOIN request_documents rd ON dr.id = rd.requestId
            JOIN document_types dt ON rd.documentTypeId = dt.id
            WHERE dr.requesterType = ?
              AND dr.requesterId = ?
              AND dr.purposeId = (SELECT id FROM request_purposes WHERE purposeName = ?)
              AND dr.statusId = 1  -- Pending status
              AND dt.documentName IN (${placeholders})
        `;

        try {
            const params = [
                requesterType,
                requesterId,
                purpose,
                ...selectedDocs
            ];

            const result = await this.dbManager.executeQuery(query, params);

            if (result[0].count > 0) {
                return "You already have a pending request for this document and purpose.";
            }
        } catch (error) {
            console.error('Error checking duplicate requests:', error);
        }

        return null;
    }

    /**
     * Layer 2 Protection: Check request cooldown period
     * @param {string} requesterType - 'student' or 'alumni'
     * @param {string} email - Requester email
     * @returns {Promise<string|null>} Error message or null if cooldown passed
     */
    async checkRequestCooldown(requesterType, requesterId) {
        const cooldownMinutes = 5;

        const query = `
            SELECT createdAt
            FROM document_requests
            WHERE requesterType = ?
              AND requesterId = ?
            ORDER BY createdAt DESC
            LIMIT 1
        `;

        try {
            const result = await this.dbManager.executeQuery(query, [requesterType, requesterId]);

            if (result.length > 0) {
                const now = new Date();
                const lastTime = new Date(result[0].createdAt);
                const diffMinutes = (now - lastTime) / (60 * 1000);

                if (diffMinutes < cooldownMinutes) {
                    const remainingMinutes = Math.ceil(cooldownMinutes - diffMinutes);
                    return `Please wait ${remainingMinutes} minutes before submitting another request.`;
                }
            }
        } catch (error) {
            console.error('Error checking request cooldown:', error);
        }

        return null;
    }

    /**
     * Layer 3 Protection: Check max pending requests
     * @param {string} requesterType - 'student' or 'alumni'
     * @param {string} email - Requester email
     * @returns {Promise<string|null>} Error message or null if under limit
     */
    async checkMaxPendingRequests(requesterType, requesterId) {
        const maxPending = 3;

        const query = `
            SELECT COUNT(*) as count
            FROM document_requests
            WHERE requesterType = ?
              AND requesterId = ?
              AND statusId = 1  -- Pending status
        `;

        try {
            const result = await this.dbManager.executeQuery(query, [requesterType, requesterId]);

            if (result[0].count >= maxPending) {
                return "You already have 3 pending requests. Please wait for approval before submitting more.";
            }
        } catch (error) {
            console.error('Error checking max pending requests:', error);
        }

        return null;
    }

    /**
     * Create new document request (generic method that delegates to specific methods)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    createRequest = async (req, res, next) => {
        const { requesterType } = req.body;

        if (requesterType === 'student') {
            return this.createStudentRequest(req, res, next);
        } else if (requesterType === 'alumni') {
            return this.createAlumniRequest(req, res, next);
        } else {
            return res.status(400).json({
                error: 'Invalid requester type',
                message: 'Requester type must be either "student" or "alumni"'
            });
        }
    };

    /**
     * Create new student document request
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    createStudentRequest = async (req, res, next) => {
        try {
            const requestData = req.body;
            requestData.requesterType = 'student'; // Force requester type

            // Enhanced debug logging
            console.log('=== STUDENT REQUEST SUBMISSION DEBUGGING ===');
            console.log('Received student request data:', JSON.stringify({
                studentNumber: requestData.studentNumber,
                spcEmail: requestData.spcEmail,
                surname: requestData.surname,
                firstName: requestData.firstName,
                middleInitial: requestData.middleInitial,
                contactNo: requestData.contactNo,
                course: requestData.course,
                year: requestData.year,
                educationalLevel: requestData.educationalLevel,
                collegeDepartment: requestData.collegeDepartment,
                purposeOfRequest: requestData.purposeOfRequest,
                otherPurpose: requestData.otherPurpose,
                tempReferenceNumber: requestData.tempReferenceNumber,
                documentsCount: requestData.documents?.length || 0
            }, null, 2));

            // Input sanitization
            Object.keys(requestData).forEach(key => {
                if (typeof requestData[key] === 'string') {
                    requestData[key] = sanitizeInput(requestData[key]);
                }
            });

            // Validate input
            const validationErrors = validateStudentRequest(requestData);
            console.log('Student validation errors found:', validationErrors);

            if (validationErrors.length > 0) {
                const formattedErrors = validationErrors.map(error => {
                    const fieldMatch = error.match(/^([^:]+)/);
                    return {
                        param: fieldMatch ? fieldMatch[1].trim() : 'general',
                        msg: error
                    };
                });

                console.log('Formatted student errors for client:', formattedErrors);
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Please check your input data',
                    errors: formattedErrors
                });
            }

            // Layer 1-3 Protections: Duplicate, Cooldown, and Max Pending Requests
            const studentId = await this.createStudentRequester(requestData);
            const protectionError = await this.checkRequestProtections(
                'student',
                studentId,
                requestData.purposeOfRequest,
                requestData.documents
            );

            if (protectionError) {
                console.log('Request protection violation:', protectionError);
                return res.status(429).json({
                    error: 'Request limit exceeded',
                    message: protectionError
                });
            }

            // Generate unique identifiers
            const requestId = this.generateRequestId();
            const requestNo = this.generateRequestNo();
            // Use client's tempReferenceNumber if provided and valid, otherwise generate new one
            const referenceNumber = this.validateAndUseTempReference(requestData.tempReferenceNumber) 
                ? requestData.tempReferenceNumber 
                : await this.generateUniqueReferenceNumber();

            console.log('Student created with ID:', studentId);

            // 2. Insert or get course first (needed for department routing for Grade 11+)
            const courseId = await this.getOrCreateCourse(requestData);
            console.log('Course created/retrieved with ID:', courseId);

            // 3. Get department_id using level-based routing
            // K-10: Route by educational level (no course needed)
            // Grade 11+: Route by course's department_id
            let departmentId = null;
            try {
                const departmentResult = await this.getDepartmentForStudent(requestData, courseId);
                if (departmentResult && departmentResult.department_id) {
                    departmentId = departmentResult.department_id;
                }
                console.log('Routed department ID:', departmentId);
            } catch (err) {
                console.error('❌ Error determining department:', err);
            }

            // 4. Find available staff for this department
            let processedBy = null;
            if (departmentId) {
                const staffQuery = 'SELECT id FROM users WHERE role = ? AND department_id = ? ORDER BY id ASC LIMIT 1';
                const staffResult = await this.dbManager.executeQuery(staffQuery, ['staff', departmentId]);
                if (staffResult.length > 0) {
                    processedBy = staffResult[0].id;
                    console.log('Assigned staff ID:', processedBy);
                }
            }

            // 5. Insert or get purpose
            const purposeId = await this.getOrCreatePurpose(requestData);
            console.log('Purpose created/retrieved with ID:', purposeId);

            // 6. Process documents and calculate total
            const { documentTypeIds, totalAmount } = await this.processDocuments(requestData.documents);
            console.log('Documents processed:', documentTypeIds.length, 'Total amount:', totalAmount);

            // 7. Insert main request (include school_year and request_semester)
            const newRequestData = {
                requestId,
                requestNo,
                referenceNumber,
                requesterId: studentId,
                requesterType: requestData.requesterType || 'student',
                courseId,
                purposeId,
                statusId: 1,
                pickupStatusId: 1,
                otherPurpose: requestData.otherPurpose || null,
                totalAmount,
                department_id: departmentId,
                processedBy,
                // Handle both camelCase and snake_case for schoolYear/school_year
                schoolYear: requestData.schoolYear || requestData.school_year || null,
                requestSemester: requestData.requestSemester || requestData.request_semester || null,
                documents: documentTypeIds.map(doc => ({
                    documentTypeId: doc.id,
                    quantity: doc.quantity,
                    unitPrice: doc.price,
                    name: doc.name  // Include document name for email
                }))
            };

            console.log('Creating student request with data:', newRequestData);
            const request = await this.documentRequestModel.create(newRequestData);
            console.log('Student request created successfully');

            // ========================================
            // SEND REQUEST SUMMARY EMAIL
            // ========================================
            console.log('=== EMAIL DEBUG START ===');
            console.log('req object keys:', Object.keys(req).join(', '));
            console.log('req.mailService:', req.mailService);
            console.log('req.app.locals.mailService:', req.app?.locals?.mailService);
            
            const mailService = req.mailService || req.app?.locals?.mailService;
            
            if (!mailService) {
                console.error('❌ CRITICAL: mailService is NOT available!');
                console.error('req.dbManager available:', !!req.dbManager);
            } else {
                console.log('✅ mailService found, type:', typeof mailService);
                console.log('mailService.sendRequestSummaryEmail:', typeof mailService.sendRequestSummaryEmail);
            }
            console.log('=== EMAIL DEBUG END ===');
            
            if (mailService && typeof mailService.sendRequestSummaryEmail === 'function') {
                try {
                    console.log('📧 Attempting to send student request summary email...');
                    
                    // Get student details for email (course is stored in requestData, not in students table)
                    const studentDetails = await this.dbManager.executeQuery(
                        'SELECT firstName, surname, contactNo, email FROM students WHERE id = ? LIMIT 1',
                        [studentId]
                    );

                    const student = studentDetails[0] || {};

                    // Prepare document data for email
                    const requestedDocuments = newRequestData.documents.map(doc => {
                        return {
                            name: doc.name || 'Document',  // Use name from processDocuments
                            quantity: doc.quantity,
                            price: doc.unitPrice,
                            schoolYear: requestData.schoolYear || requestData.school_year || null,
                            semester: requestData.requestSemester || requestData.request_semester || null
                        };
                    });

                    const emailData = {
                        toEmail: student.email || requestData.spcEmail,
                        fullName: `${student.firstName || requestData.firstName} ${student.surname || requestData.surname}`,
                        referenceNumber,
                        requestId,
                        requestNo,
                        email: student.email || requestData.spcEmail,
                        contactNo: student.contactNo || requestData.contactNo,
                        course: requestData.course,
                        year: requestData.year,
                        requesterType: 'student',
                        documents: requestedDocuments,
                        totalAmount
                    };
                    
                    console.log('📧 Email data:', JSON.stringify(emailData, null, 2));
                    
                    await mailService.sendRequestSummaryEmail(emailData);
                    console.log('✅ Student request summary email sent successfully');
                } catch (emailError) {
                    console.error('❌ Failed to send student request summary email:', emailError.message);
                    console.error('Email error stack:', emailError.stack);
                    // Don't fail the request - email is not critical
                }
            } else {
                console.warn('⚠️ mailService not available - skipping email sending');
            }

            console.log(`✅ Student request submitted successfully: ${requestId}`);

            res.status(201).json({
                success: true,
                message: 'Student document request submitted successfully',
                request: {
                    requestId,
                    requestNo,
                    referenceNumber,
                    totalAmount,
                    status: 'PENDING'
                }
            });

        } catch (error) {
            console.error('❌ Student request submission error:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                sqlMessage: error.sqlMessage,
                stack: error.stack
            });

            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({
                    error: 'Duplicate request',
                    message: 'A request with this information already exists'
                });
            }

            if (error.code === 'ER_NO_SUCH_TABLE') {
                return res.status(500).json({
                    error: 'Database setup incomplete',
                    message: 'Please run database setup first'
                });
            }

            return res.status(500).json({
                error: 'Unexpected error',
                message: error.message || 'An unexpected error occurred',
                details: error.sqlMessage || null
            });
        }
    };

    /**
     * Create new alumni document request
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    createAlumniRequest = async (req, res, next) => {
        try {
            const requestData = req.body;
            requestData.requesterType = 'alumni'; // Force requester type

            // Enhanced debug logging
            console.log('=== ALUMNI REQUEST SUBMISSION DEBUGGING ===');
            console.log('Received alumni request data:', JSON.stringify({
                spcEmail: requestData.spcEmail,
                surname: requestData.surname,
                firstName: requestData.firstName,
                middleInitial: requestData.middleInitial,
                contactNo: requestData.contactNo,
                course: requestData.course,
                collegeDepartment: requestData.collegeDepartment,
                purposeOfRequest: requestData.purposeOfRequest,
                otherPurpose: requestData.otherPurpose,
                tempReferenceNumber: requestData.tempReferenceNumber,
                documentsCount: requestData.documents?.length || 0
            }, null, 2));

            // Input sanitization
            Object.keys(requestData).forEach(key => {
                if (typeof requestData[key] === 'string') {
                    requestData[key] = sanitizeInput(requestData[key]);
                }
            });

            // Validate input
            const validationErrors = validateAlumniRequest(requestData);
            console.log('Alumni validation errors found:', validationErrors);

            if (validationErrors.length > 0) {
                const formattedErrors = validationErrors.map(error => {
                    const fieldMatch = error.match(/^([^:]+)/);
                    return {
                        param: fieldMatch ? fieldMatch[1].trim() : 'general',
                        msg: error
                    };
                });

                console.log('Formatted alumni errors for client:', formattedErrors);
                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Please check your input data',
                    errors: formattedErrors
                });
            }

            // Layer 1-3 Protections: Duplicate, Cooldown, and Max Pending Requests
            const alumniId = await this.createAlumniRequester({...requestData, file: req.file});
            const protectionError = await this.checkRequestProtections(
                'alumni',
                alumniId,
                requestData.purposeOfRequest,
                requestData.documents
            );

            if (protectionError) {
                console.log('Request protection violation:', protectionError);
                return res.status(429).json({
                    error: 'Request limit exceeded',
                    message: protectionError
                });
            }

            // Generate unique identifiers
            const requestId = this.generateRequestId();
            const requestNo = this.generateRequestNo();
            // Use client's tempReferenceNumber if provided and valid, otherwise generate new one
            const referenceNumber = this.validateAndUseTempReference(requestData.tempReferenceNumber) 
                ? requestData.tempReferenceNumber 
                : await this.generateUniqueReferenceNumber();

            console.log('Alumni created with ID:', alumniId);

            // 2. Get department_id from the created alumni safely
            let departmentId = null;
            try {
                const alumniData = await this.dbManager.executeQuery(
                    'SELECT department_id FROM alumni WHERE id = ? LIMIT 1',
                    [alumniId]
                );
                if (Array.isArray(alumniData) && alumniData.length > 0 && alumniData[0].department_id !== undefined) {
                    departmentId = alumniData[0].department_id;
                } else {
                    console.warn(`⚠️ department_id not found for alumni ID ${alumniId}, using default null`);
                }
            } catch (err) {
                console.error(`❌ Error fetching department_id for alumni ID ${alumniId}:`, err);
            }
            console.log('Alumni department ID:', departmentId);

            // 3. Find available staff for this department
            let processedBy = null;
            if (departmentId) {
                const staffQuery = 'SELECT id FROM users WHERE role = ? AND department_id = ? ORDER BY id ASC LIMIT 1';
                const staffResult = await this.dbManager.executeQuery(staffQuery, ['staff', departmentId]);
                if (staffResult.length > 0) {
                    processedBy = staffResult[0].id;
                    console.log('Assigned staff ID:', processedBy);
                }
            }

            // 4. Insert or get course
            const courseId = await this.getOrCreateCourse(requestData);
            console.log('Course created/retrieved with ID:', courseId);

            // 5. Insert or get purpose
            const purposeId = await this.getOrCreatePurpose(requestData);
            console.log('Purpose created/retrieved with ID:', purposeId);

            // 6. Process documents and calculate total
            const { documentTypeIds, totalAmount } = await this.processDocuments(requestData.documents);
            console.log('Documents processed:', documentTypeIds.length, 'Total amount:', totalAmount);

            // 7. Insert main request
            // For alumni, school_year and request_semester come from document cards (Year* and Semester dropdowns)
            // Extract from first document that has these values
            let alumniSchoolYear = null;
            let alumniRequestSemester = null;
            
            if (requestData.documents && Array.isArray(requestData.documents)) {
                const docsWithYear = requestData.documents.filter(doc => doc.year && doc.year.trim() !== '');
                if (docsWithYear.length > 0) {
                    alumniSchoolYear = docsWithYear[0].year;
                }
                const docsWithSemester = requestData.documents.filter(doc => doc.semester && doc.semester.trim() !== '');
                if (docsWithSemester.length > 0) {
                    alumniRequestSemester = docsWithSemester[0].semester;
                }
            }
            
            console.log('Alumni document-level data - schoolYear:', alumniSchoolYear, 'requestSemester:', alumniRequestSemester);
            
            const newRequestData = {
                requestId,
                requestNo,
                referenceNumber,
                requesterId: alumniId,
                requesterType: 'alumni',
                courseId,
                purposeId,
                statusId: 1,
                pickupStatusId: 1,
                otherPurpose: requestData.otherPurpose || null,
                totalAmount,
                department_id: departmentId,
                processedBy,
                // School year and semester from document cards for alumni
                schoolYear: alumniSchoolYear,
                requestSemester: alumniRequestSemester,
                documents: documentTypeIds.map(doc => ({
                    documentTypeId: doc.id,
                    quantity: doc.quantity,
                    unitPrice: doc.price,
                    name: doc.name  // Include document name for email
                }))
            };

            console.log('Creating alumni request with data:', newRequestData);
            const request = await this.documentRequestModel.create(newRequestData);
            console.log('Alumni request created successfully');

            // ========================================
            // SEND REQUEST SUMMARY EMAIL
            // ========================================
            console.log('=== ALUMNI EMAIL DEBUG START ===');
            console.log('req object keys:', Object.keys(req).join(', '));
            console.log('req.mailService:', req.mailService);
            console.log('req.app.locals.mailService:', req.app?.locals?.mailService);
            
            const mailService = req.mailService || req.app?.locals?.mailService;
            
            if (!mailService) {
                console.error('❌ CRITICAL: mailService is NOT available for alumni!');
                console.error('req.dbManager available:', !!req.dbManager);
            } else {
                console.log('✅ mailService found for alumni, type:', typeof mailService);
                console.log('mailService.sendRequestSummaryEmail:', typeof mailService.sendRequestSummaryEmail);
            }
            console.log('=== ALUMNI EMAIL DEBUG END ===');
            
            if (mailService && typeof mailService.sendRequestSummaryEmail === 'function') {
                try {
                    console.log('📧 Attempting to send alumni request summary email...');
                    
                    // Get alumni details for email
                    const alumniDetails = await this.dbManager.executeQuery(
                        'SELECT firstName, surname, contactNo, email FROM alumni WHERE id = ? LIMIT 1',
                        [alumniId]
                    );

                    const alumni = alumniDetails[0] || {};

                    // Prepare document data for email
                    const requestedDocuments = newRequestData.documents.map(doc => {
                        return {
                            name: doc.name || 'Document',  // Use name from processDocuments
                            quantity: doc.quantity,
                            price: doc.unitPrice,
                            schoolYear: alumniSchoolYear || doc.year || null,
                            semester: alumniRequestSemester || doc.semester || null
                        };
                    });

                    const emailData = {
                        toEmail: alumni.email || requestData.spcEmail,
                        fullName: `${alumni.firstName || requestData.firstName} ${alumni.surname || requestData.surname}`,
                        referenceNumber,
                        requestId,
                        requestNo,
                        email: alumni.email || requestData.spcEmail,
                        contactNo: alumni.contactNo || requestData.contactNo,
                        course: requestData.course,
                        year: null, // Alumni don't have year level
                        requesterType: 'alumni',
                        documents: requestedDocuments,
                        totalAmount
                    };
                    
                    console.log('📧 Alumni email data:', JSON.stringify(emailData, null, 2));
                    
                    await mailService.sendRequestSummaryEmail(emailData);
                    console.log('✅ Alumni request summary email sent successfully');
                } catch (emailError) {
                    console.error('❌ Failed to send alumni request summary email:', emailError.message);
                    console.error('Email error stack:', emailError.stack);
                    // Don't fail the request - email is not critical
                }
            } else {
                console.warn('⚠️ mailService not available for alumni - skipping email sending');
            }

            console.log(`✅ Alumni request submitted successfully: ${requestId}`);

            res.status(201).json({
                success: true,
                message: 'Alumni document request submitted successfully',
                request: {
                    requestId,
                    requestNo,
                    referenceNumber,
                    totalAmount,
                    status: 'PENDING'
                }
            });

        } catch (error) {
            console.error('❌ Alumni request submission error:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                sqlMessage: error.sqlMessage,
                stack: error.stack
            });

            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({
                    error: 'Duplicate request',
                    message: 'A request with this information already exists'
                });
            }

            if (error.code === 'ER_NO_SUCH_TABLE') {
                return res.status(500).json({
                    error: 'Database setup incomplete',
                    message: 'Please run database setup first'
                });
            }

            return res.status(500).json({
                error: 'Unexpected error',
                message: error.message || 'An unexpected error occurred',
                details: error.sqlMessage || null
            });
        }
    };

    // Rest of the existing methods remain unchanged

    /**
     * Get department by ID
     * @param {string|number} departmentId - Department ID
     * @returns {Promise<number>} department_id
     */
    async getDepartmentById(departmentId) {
        if (!departmentId) {
            throw new Error('Department ID is required');
        }

        if (!['string', 'number'].includes(typeof departmentId)) {
            throw new Error('Invalid department identifier');
        }

        const id = String(departmentId);

        const [rows] = await this.dbManager.executeQuery(
            'SELECT department_id, department_name FROM departments WHERE department_id = ?',
            [id]
        );

        if (rows.length === 0) {
            throw new Error(`Department not found (ID: ${id})`);
        }

        return rows[0];
    }

    /**
     * Create or get department (SAFE & DUPLICATE-PROOF) - DEPRECATED
     * @param {string|number|null} departmentInput - Department name or ID
     * @returns {Promise<Object|null>} Object with department_id or null
     */
    async getOrCreateDepartment(departmentInput) {
        if (!departmentInput) return null;

        let departmentName = '';

        if (typeof departmentInput === 'string') {
            departmentName = departmentInput.trim();
        } else if (typeof departmentInput === 'number') {
            // Convert numeric ID to name from your DB
            const result = await this.dbManager.executeQuery(
                'SELECT department_name FROM departments WHERE department_id = ?',
                [departmentInput]
            );
            if (!result[0]) return null; // no department found
            departmentName = result[0].department_name.trim();
        } else {
            throw new Error('Invalid department input');
        }

        // 🔍 Case-insensitive + trimmed lookup
        const existing = await this.dbManager.executeQuery(
            `
            SELECT department_id
            FROM departments
            WHERE LOWER(TRIM(department_name)) = LOWER(TRIM(?))
            LIMIT 1
            `,
            [departmentName]
        );

        if (existing.length > 0) {
            return { department_id: existing[0].department_id };
        }

        // ➕ Insert only if not found
        const result = await this.dbManager.executeQuery(
            'INSERT INTO departments (department_name) VALUES (?)',
            [departmentName]
        );

        return { department_id: result.insertId };
    }

    /**
     * Create or get course (Atomic version to prevent ER_DUP_ENTRY)
     * @param {Object} data
     * @returns {Promise<number>}
     */
    async getOrCreateCourse(data) {
        const courseName = data.course?.trim() || 'Not Applicable';
        const level = data.educationalLevel || null;

        // 1. Determine department_id based on educationalLevel OR programToDepartment mapping
        let departmentId = null;
        const normalizedLevel = level?.toLowerCase().trim();
        
        if (normalizedLevel === 'basic education') {
            departmentId = 4;
        } else if (normalizedLevel === 'elementary') {
            departmentId = 5;
        } else if (normalizedLevel === 'high school') {
            departmentId = 6;
        } else {
            const programMapping = this.programToDepartment[courseName];
            if (programMapping) {
                const deptResult = await this.dbManager.executeQuery(
                    `SELECT department_id FROM departments 
                     WHERE LOWER(TRIM(department_name)) = LOWER(TRIM(?)) LIMIT 1`,
                    [programMapping]
                );
                if (deptResult.length > 0) {
                    departmentId = deptResult[0].department_id;
                }
            }
        }

        // 2. Perform Atomic Upsert
        // If courseName/level exists, it will update department_id instead of crashing
        const upsertQuery = `
            INSERT INTO courses (courseName, educationalLevel, department_id)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                department_id = COALESCE(department_id, VALUES(department_id))
        `;
        
        await this.dbManager.executeQuery(upsertQuery, [courseName, level, departmentId]);

        // 3. Retrieve the ID (guaranteed to exist now)
        const existing = await this.dbManager.executeQuery(
            'SELECT id FROM courses WHERE courseName = ? AND (educationalLevel <=> ?) LIMIT 1',
            [courseName, level]
        );

        if (existing.length === 0) {
            throw new Error(`Critical Database Error: Could not resolve course ${courseName}`);
        }

        return existing[0].id;
    }

    /**
     * Create or get purpose (Atomic version to prevent ER_DUP_ENTRY)
     * @param {Object} data
     * @returns {Promise<number>}
     */
    async getOrCreatePurpose(data) {
        const purposeName = data.purposeOfRequest?.trim() || 'Not Specified';
        const otherPurpose = data.otherPurpose ? data.otherPurpose.trim() : null;

        // 1. Perform Atomic Upsert
        // If purposeName exists, it will update otherPurpose instead of crashing
        const upsertQuery = `
            INSERT INTO request_purposes (purposeName, otherPurpose)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE
                otherPurpose = COALESCE(otherPurpose, VALUES(otherPurpose))
        `;
        
        await this.dbManager.executeQuery(upsertQuery, [purposeName, otherPurpose]);

        // 2. Retrieve the ID (guaranteed to exist now)
        const existing = await this.dbManager.executeQuery(
            `SELECT id FROM request_purposes WHERE LOWER(TRIM(purposeName)) = LOWER(TRIM(?)) LIMIT 1`,
            [purposeName]
        );

        if (existing.length === 0) {
            throw new Error(`Critical Database Error: Could not resolve purpose ${purposeName}`);
        }

        return existing[0].id;
    }

    /**
     * Create or get student requester (Atomic version to prevent ER_DUP_ENTRY)
     * @param {Object} requestData - Request data
     * @returns {Promise<Object>} Object with id and type
     */
    async createStudentRequester(requestData) {
        // Validate required fields for student
        if (!requestData.studentNumber?.trim()) {
            throw new Error('Student number is required for student requesters');
        }

        // Get department from collegeDepartment
        const department = await this.getOrCreateDepartment(requestData.collegeDepartment);

        let departmentId = null;

        if (department && typeof department.department_id !== 'undefined') {
            departmentId = department.department_id;
        } else {
            console.error(`⚠️ Department not found for collegeDepartment=${requestData.collegeDepartment}`);
        }

        // 1. Perform Atomic Upsert
        // If studentNumber exists, update missing fields instead of crashing
        const studentNumber = requestData.studentNumber.trim();
        const upsertQuery = `
            INSERT INTO students (studentNumber, email, surname, firstName, middleInitial, contactNo, department_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                email = COALESCE(email, VALUES(email)),
                contactNo = COALESCE(contactNo, VALUES(contactNo)),
                department_id = COALESCE(department_id, VALUES(department_id))
        `;
        
        await this.dbManager.executeQuery(upsertQuery, [
            studentNumber,
            requestData.spcEmail.trim(),
            requestData.surname.trim(),
            requestData.firstName.trim(),
            requestData.middleInitial?.trim() || null,
            requestData.contactNo.trim(),
            departmentId
        ]);

        // 2. Retrieve the ID (guaranteed to exist now)
        const existing = await this.dbManager.executeQuery(
            'SELECT id FROM students WHERE studentNumber = ? LIMIT 1',
            [studentNumber]
        );

        if (existing.length === 0) {
            throw new Error(`Critical Database Error: Could not resolve student ${studentNumber}`);
        }

        return existing[0].id;
    }

    /**
     * Create or get alumni requester
     * @param {Object} requestData - Request data
     * @returns {Promise<Object>} Object with id and type
     */
    async createAlumniRequester(requestData) {
        // Note: graduationYear is now optional for alumni (schoolYear/semester stored in document_requests)
        
        // Determine department_id based on course mapping for alumni
        let departmentId = null;
        
        // First, try to get department from collegeDepartment if provided
        if (requestData.collegeDepartment) {
            const department = await this.getOrCreateDepartment(requestData.collegeDepartment);
            if (department && typeof department.department_id !== 'undefined') {
                departmentId = department.department_id;
            }
        }
        
        // Fallback: Use programToDepartment mapping based on course
        if (!departmentId && requestData.course) {
            const programMapping = this.programToDepartment[requestData.course.trim()];
            if (programMapping) {
                const deptFromMapping = await this.getOrCreateDepartment(programMapping);
                if (deptFromMapping && deptFromMapping.department_id) {
                    departmentId = deptFromMapping.department_id;
                    console.log(`Alumni course "${requestData.course}" mapped to department: ${programMapping} (ID: ${departmentId})`);
                }
            } else {
                console.warn(`No department mapping found for alumni course: ${requestData.course}`);
            }
        }

        // Check if alumni already exists in alumni table
        const existingAlumni = await this.dbManager.executeQuery(
            'SELECT id, contactNo, department_id FROM alumni WHERE email = ?',
            [requestData.spcEmail.trim()]
        );

        if (existingAlumni.length > 0) {
            // Update existing alumni with any missing fields
            const updateFields = [];
            const updateValues = [];

            if (!existingAlumni[0].contactNo && requestData.contactNo) {
                updateFields.push('contactNo = ?');
                updateValues.push(requestData.contactNo.trim());
            }
            // Note: graduationYear is no longer stored - schoolYear/semester are from document cards
            if (!existingAlumni[0].department_id && departmentId) {
                updateFields.push('department_id = ?');
                updateValues.push(departmentId);
            }

            if (updateFields.length > 0) {
                updateValues.push(existingAlumni[0].id);
                const updateQuery = `UPDATE alumni SET ${updateFields.join(', ')} WHERE id = ?`;
                await this.dbManager.executeQuery(updateQuery, updateValues);
                console.log(`Updated existing alumni ID ${existingAlumni[0].id} with department_id: ${departmentId}`);
            }

            return existingAlumni[0].id;
        }

        // Get the uploaded file path if available
        const verificationPhotoPath = requestData.file ? requestData.file.filename : null;

        // Insert into alumni table (without graduationYear)
        const alumniQuery = `
            INSERT INTO alumni (email, surname, firstName, middleInitial, contactNo, department_id, verification_photo)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const alumniResult = await this.dbManager.executeQuery(alumniQuery, [
            requestData.spcEmail.trim(),
            requestData.surname.trim(),
            requestData.firstName.trim(),
            requestData.middleInitial?.trim() || null,
            requestData.contactNo.trim(),
            departmentId,
            verificationPhotoPath
        ]);

        console.log(`Created new alumni with ID ${alumniResult.insertId}, department_id: ${departmentId}`);
        return alumniResult.insertId;
    }

    /**
     * Track request by reference number
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    trackRequest = async (req, res, next) => {
        try {
            const { referenceNumber } = req.params;

            // Validate reference number format
            const isValidReference = referenceNumber.startsWith('SPC-DOC-') || referenceNumber.startsWith('REF-');
            const isValidRequestNumber = /^\d{12}$/.test(referenceNumber);

            if (!isValidReference && !isValidRequestNumber) {
                return res.status(400).json({
                    error: 'Invalid tracking ID format',
                    message: 'Please enter a valid reference number (SPC-DOC-XXXXXX-XXXX or REF-XXXXXX-XXXX) or request number (12 digits).'
                });
            }

            let query, params;

            if (isValidReference) {
                // Search by reference number
                query = `
                    SELECT
                        dr.id,
                        dr.requestId,
                        dr.requestNo,
                        dr.referenceNumber,
                        dr.statusId,
                        dr.scheduledPickup,
                        dr.totalAmount,
                        dr.createdAt,
                        s.firstName,
                        s.surname,
                        s.studentNumber,
                        a.firstName as alumniFirstName,
                        a.surname as alumniSurname,
                        a.email as alumniEmail,
                        dr.requesterType,
                        rs.statusName as status
                    FROM document_requests dr
                    LEFT JOIN students s ON dr.requesterId = s.id AND dr.requesterType = 'student'
                    LEFT JOIN alumni a ON dr.requesterId = a.id AND dr.requesterType = 'alumni'
                    LEFT JOIN request_statuses rs ON dr.statusId = rs.id
                    WHERE dr.referenceNumber = ?
                `;
                params = [referenceNumber];
            } else {
                // Search by request number
                query = `
                    SELECT
                        dr.id,
                        dr.requestId,
                        dr.requestNo,
                        dr.referenceNumber,
                        dr.statusId,
                        dr.scheduledPickup,
                        dr.totalAmount,
                        dr.createdAt,
                        s.firstName,
                        s.surname,
                        s.studentNumber,
                        a.firstName as alumniFirstName,
                        a.surname as alumniSurname,
                        a.email as alumniEmail,
                        dr.requesterType,
                        rs.statusName as status
                    FROM document_requests dr
                    LEFT JOIN students s ON dr.requesterId = s.id AND dr.requesterType = 'student'
                    LEFT JOIN alumni a ON dr.requesterId = a.id AND dr.requesterType = 'alumni'
                    LEFT JOIN request_statuses rs ON dr.statusId = rs.id
                    WHERE dr.requestNo = ?
                `;
                params = [referenceNumber];
            }

            const result = await this.dbManager.executeQuery(query, params);

            if (result.length === 0) {
                return res.status(404).json({
                    error: 'Request not found',
                    message: `Request with ID "${referenceNumber}" not found.`
                });
            }

            const request = result[0];

            // Get documents for this request
            const documentsQuery = `
                SELECT
                    dt.documentName as name,
                    rd.quantity,
                    rd.unitPrice as price,
                    rd.quantity > 0 as checked
                FROM request_documents rd
                JOIN document_types dt ON rd.documentTypeId = dt.id
                WHERE rd.requestId = ?
            `;
            const documents = await this.dbManager.executeQuery(documentsQuery, [request.id]);

            // Format the response
            const formattedRequest = {
                id: request.id,
                requestId: request.requestId,
                requestNo: request.requestNo,
                referenceNumber: request.referenceNumber,
                status: request.status,
                scheduledPickup: request.scheduledPickup,
                totalAmount: request.totalAmount,
                createdAt: request.createdAt,
                requesterType: request.requesterType,
                firstName: request.requesterType === 'student' ? request.firstName : request.alumniFirstName,
                surname: request.requesterType === 'student' ? request.surname : request.alumniSurname,
                studentNumber: request.studentNumber,
                documents: documents
            };

            // Generate basic tracking information
            const tracking = this.generateTrackingInfo(request.statusId, request.createdAt, request.scheduledPickup);

            res.json({
                success: true,
                request: formattedRequest,
                tracking: tracking
            });

        } catch (error) {
            console.error('Track request error:', error);
            res.status(500).json({
                error: 'Server error',
                message: 'Failed to track request. Please try again later.'
            });
        }
    };

    /**
     * Get request by ID
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    getRequestById = async (req, res, next) => {
        try {
            const { id } = req.params;

            const query = `
                SELECT
                    dr.id,
                    dr.requestId,
                    dr.requestNo,
                    dr.referenceNumber,
                    dr.statusId,
                    dr.scheduledPickup,
                    dr.totalAmount,
                    dr.createdAt,
                    dr.updatedAt,
                    s.firstName,
                    s.surname,
                    s.studentNumber,
                    a.firstName as alumniFirstName,
                    a.surname as alumniSurname,
                    a.email as alumniEmail,
                    dr.requesterType,
                    rs.statusName as status,
                    ps.statusName as pickupStatus,
                    rp.purposeName,
                    rp.otherPurpose
                FROM document_requests dr
                LEFT JOIN students s ON dr.requesterId = s.id AND dr.requesterType = 'student'
                LEFT JOIN alumni a ON dr.requesterId = a.id AND dr.requesterType = 'alumni'
                LEFT JOIN request_statuses rs ON dr.statusId = rs.id
                LEFT JOIN pickup_statuses ps ON dr.pickupStatusId = ps.id
                LEFT JOIN request_purposes rp ON dr.purposeId = rp.id
                WHERE dr.id = ?
            `;

            const result = await this.dbManager.executeQuery(query, [id]);

            if (result.length === 0) {
                return res.status(404).json({
                    error: 'Request not found',
                    message: `Request with ID ${id} not found`
                });
            }

            const request = result[0];

            // Get documents for this request
            const documentsQuery = `
                SELECT
                    dt.documentName as name,
                    rd.quantity,
                    rd.unitPrice as price,
                    rd.quantity > 0 as checked
                FROM request_documents rd
                JOIN document_types dt ON rd.documentTypeId = dt.id
                WHERE rd.requestId = ?
            `;
            const documents = await this.dbManager.executeQuery(documentsQuery, [request.id]);

            // Get transaction history
            const historyQuery = `
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
            const history = await this.dbManager.executeQuery(historyQuery, [request.id]);

            res.json({
                success: true,
                request: {
                    ...request,
                    documents,
                    history
                }
            });

        } catch (error) {
            console.error('Get request by ID error:', error);
            res.status(500).json({
                error: 'Server error',
                message: 'Failed to fetch request details'
            });
        }
    };

    /**
     * Delete request
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    deleteRequest = async (req, res) => {
        try {
            const { id } = req.params;

            // Check if request exists
            const [result] = await this.dbManager.executeQuery(
                'DELETE FROM document_requests WHERE id = ?',
                [id]
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
            return res.status(500).json({
                success: false,
                message: 'Failed to delete request'
            });
        }
    };

    /**
     * Update request status
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    updateRequest = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { status, statusId } = req.body;

            console.log(`=== UPDATE REQUEST DEBUG ===`);
            console.log(`Request ID: ${id}`);
            console.log(`status: ${status}`);
            console.log(`statusId: ${statusId}`);

            if (!status && !statusId) {
                return res.status(400).json({
                    error: 'Validation error',
                    message: 'Status or statusId is required'
                });
            }

            // Get the current (old) status before updating
            const [currentRequest] = await this.dbManager.executeQuery(
                'SELECT statusId FROM document_requests WHERE id = ?',
                [id]
            );

            console.log(`Current request from DB:`, currentRequest);

            if (!currentRequest) {
                return res.status(404).json({
                    error: 'Request not found',
                    message: `Request with ID ${id} not found`
                });
            }

            const oldStatusId = currentRequest.statusId;
            console.log(`Old statusId: ${oldStatusId}`);

            let finalStatusId;

            // Handle both status (string) and statusId (number) inputs
            if (statusId) {
                // If statusId is provided, use it directly
                finalStatusId = parseInt(statusId);
                
                // Validate that the statusId is within valid range (1-5)
                if (finalStatusId < 1 || finalStatusId > 5) {
                    return res.status(400).json({
                        error: 'Validation error',
                        message: 'Invalid statusId. Must be between 1 and 5.'
                    });
                }
            } else {
                // If status string is provided, convert to statusId
                const normalizedStatus = status.toUpperCase().replace(/\s+/g, '_');

                // Map frontend status values to database status names
                const statusMapReverse = {
                    'DECLINED': 'DECLINE',
                    'READY_FOR_PICKUP': 'READY',
                    'RELEASED': 'RELEASED',
                    'PENDING': 'PENDING',
                    'PROCESSING': 'PROCESSING'
                };

                const dbStatus = statusMapReverse[normalizedStatus] || normalizedStatus;

                // Retrieve correct statusId from request_statuses
                const [statusRow] = await this.dbManager.executeQuery(
                    'SELECT id FROM request_statuses WHERE statusName = ?',
                    [dbStatus]
                );

                if (!statusRow) {
                    return res.status(400).json({
                        error: 'Validation error',
                        message: 'Invalid status'
                    });
                }

                finalStatusId = statusRow.id;
            }

            console.log(`Final statusId to set: ${finalStatusId}`);

            // Update document_requests using the final statusId
            await this.dbManager.executeQuery(
                'UPDATE document_requests SET statusId = ?, updatedAt = NOW() WHERE id = ?',
                [finalStatusId, id]
            );

            // Handle optional dateCompleted logic
            const [statusInfo] = await this.dbManager.executeQuery(
                'SELECT statusName FROM request_statuses WHERE id = ?',
                [finalStatusId]
            );

            if (statusInfo && statusInfo.statusName === 'RELEASED') {
                await this.dbManager.executeQuery(
                    'UPDATE document_requests SET dateCompleted = NOW() WHERE id = ?',
                    [id]
                );
            }

            // ========================================
            // TRIGGER EMAIL NOTIFICATION FOR READY_FOR_PICKUP
            // ========================================
            // Check if status changed to READY_FOR_PICKUP (statusId 3) and old status was NOT 3
            // Note: Frontend uses statusId=3 for READY_FOR_PICKUP, statusId=4 for RELEASED
            const READY_STATUS_ID = 3; 
            
            if (finalStatusId === READY_STATUS_ID && oldStatusId !== READY_STATUS_ID) {
                console.log(`📧 Status changed to READY_FOR_PICKUP for request ID ${id} - triggering email notification`);
                console.log(`   Old status: ${oldStatusId}, New status: ${finalStatusId}`);
                
                // Get mailService from request
                const mailService = req.mailService || req.app?.locals?.mailService;
                console.log(`   mailService available:`, !!mailService);
                console.log(`   sendReadyForPickupEmail method exists:`, typeof mailService?.sendReadyForPickupEmail);
                
                if (mailService && typeof mailService.sendReadyForPickupEmail === 'function') {
                    try {
                        // Get request details including requester info and email
                        // Students table uses 'email' column, Alumni table uses 'email' column
                        const requestDetails = await this.dbManager.executeQuery(
                            `SELECT 
                                dr.referenceNumber,
                                dr.scheduledPickup,
                                dr.requesterType,
                                dr.requesterId,
                                s.email as studentEmail,
                                s.firstName,
                                s.surname,
                                a.email as alumniEmail,
                                a.firstName as alumniFirstName,
                                a.surname as alumniSurname
                            FROM document_requests dr
                            LEFT JOIN students s ON dr.requesterType = 'student' AND dr.requesterId = s.id
                            LEFT JOIN alumni a ON dr.requesterType = 'alumni' AND dr.requesterId = a.id
                            WHERE dr.id = ?`,
                            [id]
                        );

                        console.log(`   Request details found:`, requestDetails.length > 0);
                        
                        if (requestDetails.length > 0) {
                            const request = requestDetails[0];
                            console.log(`   Full request object:`, JSON.stringify(request));
                            console.log(`   Requester type:`, request.requesterType);
                            console.log(`   Student email:`, request.studentEmail);
                            console.log(`   Alumni email:`, request.alumniEmail);
                            
                            // Get document types for this request
                            const documents = await this.dbManager.executeQuery(
                                `SELECT dt.documentName 
                                FROM request_documents rd 
                                JOIN document_types dt ON rd.documentTypeId = dt.id 
                                WHERE rd.requestId = ?`,
                                [id]
                            );

                            const documentType = documents.length > 0 
                                ? documents.map(d => d.documentName).join(', ') 
                                : 'Document';

                            // Get student/alumni email and name based on requesterType
                            // Use the email from the students/alumni table (the provided email)
                            const toEmail = request.requesterType === 'student' 
                                ? request.studentEmail 
                                : request.alumniEmail;
                            
                            const fullName = request.requesterType === 'student' 
                                ? `${request.firstName || ''} ${request.surname || ''}`.trim()
                                : `${request.alumniFirstName || ''} ${request.alumniSurname || ''}`.trim();

                            console.log(`   Final toEmail:`, toEmail);
                            console.log(`   Full name:`, fullName);

                            if (toEmail && fullName) {
                                const emailData = {
                                    toEmail: toEmail,
                                    fullName: fullName,
                                    referenceNumber: request.referenceNumber,
                                    documentType: documentType,
                                    scheduledPickup: request.scheduledPickup
                                };

                                console.log('📧 Sending ready for pickup email with data:', JSON.stringify(emailData, null, 2));
                                
                                const emailResult = await mailService.sendReadyForPickupEmail(emailData);
                                if (emailResult) {
                                    console.log(`✅ Ready for pickup email SENT successfully to ${toEmail} for request ID ${id}`);
                                } else {
                                    console.log(`⚠️ Ready for pickup email FAILED to send to ${toEmail} for request ID ${id}`);
                                }
                            } else {
                                console.warn(`⚠️ Could not send email - missing email or name for request ID ${id}`);
                                console.warn(`   toEmail:`, toEmail, `fullName:`, fullName);
                            }
                        }
                    } catch (emailError) {
                        console.error('❌ Failed to send ready for pickup email:', emailError.message);
                        console.error('Email error stack:', emailError.stack);
                        // Don't fail the request - email is not critical
                    }
                } else {
                    console.warn('⚠️ mailService not available - skipping ready for pickup email');
                }
            }

            // Return updated row with joined statusName for frontend consistency
            const [updatedRow] = await this.dbManager.executeQuery(
                `SELECT dr.id, dr.statusId, rs.statusName, dr.updatedAt
                 FROM document_requests dr
                 JOIN request_statuses rs ON dr.statusId = rs.id
                 WHERE dr.id = ?`,
                [id]
            );

            if (!updatedRow) {
                return res.status(404).json({
                    error: 'Request not found',
                    message: `Request with ID ${id} not found`
                });
            }

            res.json({
                success: true,
                message: 'Request status updated successfully',
                request: updatedRow
            });

        } catch (error) {
            console.error('Update request error:', error);
            res.status(500).json({
                error: 'Server error',
                message: 'Failed to update request status'
            });
        }
    };

    /**
     * Update request schedule
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    updateSchedule = async (req, res) => {
        try {
            const { id } = req.params;
            const { scheduledPickup } = req.body;

            if (!scheduledPickup) {
                return res.status(400).json({
                    error: 'Validation error',
                    message: 'Scheduled pickup date is required'
                });
            }

            // Validate date format (YYYY-MM-DD)
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(scheduledPickup)) {
                return res.status(400).json({
                    error: 'Validation error',
                    message: 'Invalid date format. Use YYYY-MM-DD'
                });
            }

            // Update the scheduled pickup date
            const updateQuery = 'UPDATE document_requests SET scheduledPickup = ?, updatedAt = NOW() WHERE id = ?';
            const result = await this.dbManager.executeQuery(updateQuery, [scheduledPickup, id]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    error: 'Request not found',
                    message: `Request with ID ${id} not found`
                });
            }

            res.json({
                success: true,
                message: 'Scheduled pickup date updated successfully'
            });

        } catch (error) {
            console.error('Update schedule error:', error);
            res.status(500).json({
                error: 'Server error',
                message: 'Failed to update scheduled pickup date'
            });
        }
    };

    /**
     * Generate tracking information based on status
     * @param {number} statusId - Status ID
     * @param {string} createdAt - Creation date
     * @param {string} scheduledPickup - Scheduled pickup date
     * @returns {Array} Tracking stages
     */
    generateTrackingInfo(statusId, createdAt, scheduledPickup) {
        const stages = [
            { stage: 'Request Submitted', date: new Date(createdAt).toLocaleDateString(), type: 'done' },
            { stage: 'Under Review', date: statusId >= 2 ? 'Completed' : 'In progress', type: statusId >= 2 ? 'done' : statusId === 2 ? 'current' : 'pending' },
            { stage: 'Processing', date: statusId >= 3 ? 'Completed' : statusId === 2 ? 'In progress' : 'Pending', type: statusId >= 3 ? 'done' : statusId === 2 ? 'current' : 'pending' },
            { stage: 'Ready for Pickup', date: statusId >= 4 ? (scheduledPickup || 'Ready') : 'Pending', type: statusId >= 4 ? 'done' : statusId === 3 ? 'current' : 'pending' },
            { stage: 'Completed', date: statusId >= 5 ? 'Completed' : 'Pending', type: statusId >= 5 ? 'done' : 'pending' }
        ];

        return stages;
    }

    /**
     * Process documents and calculate total amount
     * @param {Array} documents - Array of document objects
     * @returns {Promise<Object>} Object with documentTypeIds and totalAmount
     */
    async processDocuments(documents) {
        const documentTypeIds = [];
        let totalAmount = 0;

        // Filter and process only checked documents with quantity > 0
        const validDocuments = documents.filter(doc => doc.checked && doc.quantity > 0);

        for (const doc of validDocuments) {
            // Get document type information from database
            const documentType = await this.dbManager.executeQuery(
                'SELECT id, basePrice FROM document_types WHERE documentName = ?',
                [doc.name]
            );

            if (documentType.length === 0) {
                throw new Error(`Document type not found: ${doc.name}`);
            }

            const docTypeId = documentType[0].id;
            const docBasePrice = documentType[0].basePrice;
            const quantity = doc.quantity || 1;

            // Add document information to the array (now includes the document name for email)
            documentTypeIds.push({
                id: docTypeId,
                name: doc.name,  // Include the document name for email summary
                quantity: quantity,
                price: docBasePrice
            });

            // Calculate total amount using basePrice
            totalAmount += docBasePrice * quantity;
        }

        return { documentTypeIds, totalAmount };
    }
}

/**
 * Standalone getAllRequests function for simpler usage
 * @param {Object} db - Database connection
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const getAllRequests = async (db, req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const query = `
            SELECT
                dr.*,
                rs.statusName AS statusName,
                s.firstName AS studentFirstName,
                s.surname AS studentSurname,
                s.studentNumber,
                s.email AS studentEmail,
                s.contactNo AS studentContactNo,
                a.firstName AS alumniFirstName,
                a.surname AS alumniSurname,
                a.email AS alumniEmail,
                a.contactNo AS alumniContactNo,
                -- graduationYear removed - not stored in alumni table
                a.verification_photo,
                c.courseName,
                c.educationalLevel,
                d.department_name,
                rp.purposeName,
                u.firstName AS processedByFirstName,
                u.lastName AS processedByLastName,
                GROUP_CONCAT(DISTINCT dt.documentName ORDER BY dt.id SEPARATOR ' | ') AS document_list,
                GROUP_CONCAT(rd.quantity ORDER BY dt.id SEPARATOR ' | ') AS quantity_list,
                dr.createdAt AS requestedAt
            FROM document_requests dr
            LEFT JOIN request_statuses rs ON dr.statusId = rs.id
            LEFT JOIN students s ON dr.requesterType = 'student' AND dr.requesterId = s.id
            LEFT JOIN alumni a ON dr.requesterType = 'alumni' AND dr.requesterId = a.id
            LEFT JOIN courses c ON dr.courseId = c.id
            LEFT JOIN departments d ON c.department_id = d.department_id
            LEFT JOIN request_purposes rp ON dr.purposeId = rp.id
            LEFT JOIN users u ON dr.processedBy = u.id
            LEFT JOIN request_documents rd ON dr.id = rd.requestId
            LEFT JOIN document_types dt ON rd.documentTypeId = dt.id
            GROUP BY dr.id
            ORDER BY dr.createdAt DESC
            LIMIT ? OFFSET ?
        `;

        const rows = await db.executeQuery(query, [limit, offset]);

        // Transform the data to match frontend expectations
        const transformedData = rows.map(row => {
            return {
                ...row,
                // Map requester name based on type
                requesterName: row.requesterType === 'student'
                    ? `${row.studentFirstName || ''} ${row.studentSurname || ''}`.trim() || 'Unknown'
                    : `${row.alumniFirstName || ''} ${row.alumniSurname || ''}`.trim() || 'Unknown',

                // Map contact number based on type
                contactNo: row.requesterType === 'student'
                    ? row.studentContactNo || row.contactNo || 'N/A'
                    : row.alumniContactNo || row.contactNo || 'N/A',

                // Map email based on type (use 'email' for frontend compatibility)
                email: row.requesterType === 'student'
                    ? row.studentEmail || 'N/A'
                    : row.alumniEmail || 'N/A',
                requesterEmail: row.requesterType === 'student'
                    ? row.studentEmail || 'N/A'
                    : row.alumniEmail || 'N/A',

                // Map course name (use 'course' for frontend compatibility)
                course: row.courseName || 'N/A',
                courseName: row.courseName || 'N/A',
                
                // Map educational level
                educationalLevel: row.educationalLevel || 'N/A',
                
                // Map department name
                departmentName: row.department_name || 'N/A',

                // Map purpose name (use 'purpose' for frontend compatibility)
                purpose: row.purposeName || 'N/A',
                purposeName: row.purposeName || 'N/A',

                // Map document types (use 'documents' for frontend compatibility)
                documents: row.document_list || 'N/A',
                documentTypes: row.document_list || 'N/A',
                document_list: row.document_list || null,
                quantity_list: row.quantity_list || null,

                // Ensure statusName is set
                statusName: row.statusName || row.status || 'PENDING',

                // Map student number (for alumni, show N/A since graduationYear is no longer stored)
                studentNumber: row.requesterType === 'student'
                    ? row.studentNumber || 'N/A'
                    : 'N/A',

                // Map school year and semester for frontend compatibility
                schoolYear: row.school_year || 'N/A',
                requestSemester: row.request_semester || 'N/A'
            };
        });

        res.json({
            success: true,
            data: transformedData,
            page,
            limit,
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    RequestController,
    getAllRequests
};
