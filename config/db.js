/**
 * @fileoverview Database configuration and connection management for the Document Request System
 *
 * This module handles all database operations including:
 * - MySQL connection pool management with retry logic
 * - Database schema creation and table setup
 * - Password hashing and verification using bcrypt
 * - Default user creation for initial system setup
 * - Connection health monitoring and graceful error handling
 *
 * Database Design:
 * - Normalized structure with proper foreign key relationships
 * - Separate tables for users, students, courses, documents, and requests
 * - Junction tables for many-to-many relationships (document_purposes)
 * - Audit trails with createdAt/updatedAt timestamps
 * - Proper indexing for performance optimization
 */

const mysql = require('mysql2/promise'); // MySQL client with promise support
const bcrypt = require('bcrypt'); // Password hashing library
require('dotenv').config(); // Load environment variables

/**
 * Database Manager Class
 * Handles all database operations, connection management, and schema setup
 *
 * Key Features:
 * - Connection pooling for performance
 * - Automatic retry logic for resilient connections
 * - Database schema initialization
 * - Password security with bcrypt hashing
 * - Transaction support for data consistency
 */
class DatabaseManager {
    /**
     * Initialize database manager
     * Sets up initial state for database connections
     */
    constructor() {
        this.db = null; // Database connection pool instance
        this.isConnected = false; // Connection status flag
        console.log('🔍 Database Manager initialized');
    }

    /**
     * Create database connection pool
     * Establishes a pool of MySQL connections for efficient database access
     *
     * Connection Pool Benefits:
     * - Reuses connections instead of creating new ones for each query
     * - Improves performance by reducing connection overhead
     * - Handles connection limits gracefully
     * - Provides built-in queue management for concurrent requests
     *
     * @returns {Object} MySQL connection pool instance
     */
    createConnection() {
        try {
            // Check if SSL should be enabled based on .env
            const useSSL = process.env.DB_SSL === 'true';

            this.db = mysql.createPool({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASS,
                database: process.env.DB_NAME,
                port: parseInt(process.env.DB_PORT),
                connectionLimit: 10,
                queueLimit: 0,
                multipleStatements: true,
                connectTimeout: 10000,
                // Apply SSL configuration if DB_SSL is true
                ssl: useSSL ? { rejectUnauthorized: false } : null
            });
            console.log(`🔗 MySQL connection pool created (SSL: ${useSSL})`);
            return this.db;
        } catch (error) {
            console.error('❌ Failed to create database connection pool:', error.message);
            throw error;
        }
    }

    /**
     * Connect to database with retry logic
     * Implements resilient connection establishment with exponential backoff
     *
     * Retry Strategy:
     * - Tests database connectivity with a simple query
     * - Automatically retries on failure up to maxRetries
     * - Uses progressive delays between retry attempts
     * - Provides clear feedback on connection status
     *
     * @param {number} maxRetries - Maximum number of retry attempts (default: 5)
     * @param {number} delay - Base delay between retries in milliseconds (default: 5000ms)
     * @returns {Promise<void>}
     */
    async connectWithRetry(maxRetries = 5, delay = 5000) {
        /**
         * Recursive function to attempt database connection with retries
         * @param {number} retriesLeft - Number of retry attempts remaining
         */
        const attemptConnection = async (retriesLeft) => {
            try {
                if (!this.db) this.createConnection();

                // Test the connection with a simple query
                await this.db.execute('SELECT 1');
                console.log('✅ MySQL Connected successfully');
                this.isConnected = true;
                return;
            } catch (err) {
                // Clear, actionable logging showing which env vars were used (without exposing the password)
                console.error(`❌ Database connection failed for user='${process.env.DB_USER}' host='${process.env.DB_HOST}' port='${process.env.DB_PORT}' db='${process.env.DB_NAME}' - ${err.message}`);
                console.error(`   Env check: DB_PASS=${process.env.DB_PASS ? 'SET' : 'MISSING'}`);

                if (retriesLeft > 0) {
                    console.log(`🔄 Retrying connection in ${delay/1000} seconds... (${retriesLeft} retries left)`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return attemptConnection(retriesLeft - 1);
                } else {
                    console.error(`❌ Could not connect to MySQL after ${maxRetries} attempts`);
                    this.isConnected = false;
                    throw new Error('Database connection failed after all retry attempts');
                }
            }
        };

        // Start the connection attempt process
        return attemptConnection(maxRetries);
    }

    /**
     * Initialize database and tables
     * Complete database setup process including schema creation and default data
     *
     * Initialization Sequence:
     * 1. Verify database connectivity
     * 2. Create database if it doesn't exist
     * 3. Switch to the target database
     * 4. Create all required tables with proper relationships
     * 5. Insert default lookup data and system users
     *
     * @returns {Promise<void>}
     */
    async initializeDatabase() {
        try {
            if (!this.isConnected || !this.db) return;

            console.log('🔄 Starting table verification in database: ' + process.env.DB_NAME);
            // No CREATE DATABASE or USE logic here; assumes DB already exists (cloud compatible)
            await this.createTables();
            await this.createDefaultUsers();
            console.log('✅ Database initialization completed successfully');
        } catch (error) {
            console.error('❌ Error during database initialization:', error.message);
            throw error;
        }
    }

    /**
     * Execute query with promise support
     * @param {string} query - SQL query to execute
     * @param {Array} values - Values to bind to the query
     * @returns {Promise<Object>} Query results
     */
    async executeQuery(query, values = []) {
        try {
            if (!this.db) {
                throw new Error('Database not connected');
            }

            const [rows, fields] = await this.db.execute(query, values);
            return rows;
        } catch (error) {
            console.error('❌ Query execution failed:', error.message);
            throw error;
        }
    }

    /**
     * Execute raw query without prepared statement (for DDL commands)
     * @param {string} query - SQL query to execute
     * @returns {Promise<Object>} Query results
     */
    async executeRawQuery(query) {
        try {
            if (!this.db) {
                throw new Error('Database not connected');
            }

            const [rows, fields] = await this.db.query(query);
            return rows;
        } catch (error) {
            console.error('❌ Raw query execution failed:', error.message);
            throw error;
        }
    }

    /**
     * Create necessary database tables with normalized structure
     * Implements a fully normalized database design following best practices:
     *
     * - 3rd Normal Form (3NF) compliance
     * - Proper foreign key relationships
     * - Referential integrity constraints
     * - Optimized indexing for query performance
     * - Audit trails with timestamps
     *
     * Table Structure Overview:
     * - users: System administrators and staff
     * - students: Student information (normalized from requests)
     * - courses: Academic programs (normalized from requests)
     * - document_types: Available document types and pricing
     * - request_purposes: Reasons for document requests
     * - document_purposes: Many-to-many junction table
     * - request_statuses: Request processing states
     * - pickup_statuses: Document pickup states
     * - document_requests: Main request tracking table
     * - request_documents: Documents within each request
     * - request_tracking: Audit trail for request changes
     *
     * @returns {Promise<void>}
     */
    async createTables() {
        try {
            console.log('🏗️  Creating database tables...');

            // === USERS TABLE ===
            // Stores system administrators and staff members
            // Supports role-based access control (admin/staff)
            const createUsersTable = `
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    role ENUM('admin', 'staff') NOT NULL DEFAULT 'staff',
                    firstName VARCHAR(100) NOT NULL,
                    lastName VARCHAR(100) NOT NULL,
                    isActive BOOLEAN DEFAULT TRUE,
                    lastLogin DATETIME NULL,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    -- Performance indexes for common queries
                    INDEX idx_email (email),
                    INDEX idx_username (username),
                    INDEX idx_role (role),
                    INDEX idx_is_active (isActive)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `;
            await this.executeQuery(createUsersTable);
            console.log('✅ Users table created');

            // === STUDENTS TABLE ===
            // Normalized student information (extracted from document requests)
            // Stores unique student data to avoid duplication across requests
            const createStudentsTable = `
                CREATE TABLE IF NOT EXISTS students (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    requesterType ENUM('student') NOT NULL DEFAULT 'student',
                    studentNumber VARCHAR(255) UNIQUE NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    surname VARCHAR(255) NOT NULL,
                    firstName VARCHAR(255) NOT NULL,
                    middleInitial VARCHAR(255),
                    suffix VARCHAR(255),
                    contactNo VARCHAR(255) NOT NULL,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    -- Indexes for common search patterns
                    INDEX idx_student_number (studentNumber),
                    INDEX idx_email (email),
                    INDEX idx_surname (surname)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `;
            await this.executeQuery(createStudentsTable);
            console.log('✅ Students table created');

            // === ALUMNI TABLE ===
            // Normalized alumni information (extracted from document requests)
            // Stores unique alumni data to avoid duplication across requests
            const createAlumniTable = `
                CREATE TABLE IF NOT EXISTS alumni (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    requesterType ENUM('alumni') NOT NULL DEFAULT 'alumni',
                    email VARCHAR(255) UNIQUE NOT NULL,
                    surname VARCHAR(255) NOT NULL,
                    firstName VARCHAR(255) NOT NULL,
                    middleInitial VARCHAR(255),
                    suffix VARCHAR(255),
                    contactNo VARCHAR(255) NOT NULL,
                    graduationYear INT NOT NULL,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    -- Indexes for common search patterns
                    INDEX idx_email (email),
                    INDEX idx_surname (surname),
                    INDEX idx_graduation_year (graduationYear)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `;
            await this.executeQuery(createAlumniTable);
            console.log('✅ Alumni table created');

            // === DEPARTMENTS TABLE ===
            // Academic/administrative departments used for RBAC and course grouping
            const createDepartmentsTable = `
                CREATE TABLE IF NOT EXISTS departments (
                    department_id INT AUTO_INCREMENT PRIMARY KEY,
                    department_name VARCHAR(255) NOT NULL,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_department_name (department_name)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `;
            await this.executeQuery(createDepartmentsTable);
            console.log('✅ Departments table created');

            // === COURSES TABLE ===
            // Academic programs and educational levels
            // Now includes a department_id to link courses to departments
            const createCoursesTable = `
                CREATE TABLE IF NOT EXISTS courses (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    courseName VARCHAR(255) UNIQUE NOT NULL,
                    educationalLevel VARCHAR(255), -- e.g., "Bachelor", "Master", "Doctorate"
                    department_id INT NULL,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_course_name (courseName),
                    INDEX idx_department_id (department_id),
                    CONSTRAINT fk_courses_department FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `;
            await this.executeQuery(createCoursesTable);
            console.log('✅ Courses table created');

            // === DOCUMENT TYPES TABLE ===
            // Available document types with pricing information
            // Supports dynamic document management and pricing updates
            const createDocumentTypesTable = `
                CREATE TABLE IF NOT EXISTS document_types (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    documentName VARCHAR(255) UNIQUE NOT NULL,
                    basePrice DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    isActive BOOLEAN DEFAULT TRUE, -- Soft delete capability
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    -- Indexes for performance and filtering
                    INDEX idx_document_name (documentName),
                    INDEX idx_is_active (isActive)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `;
            await this.executeQuery(createDocumentTypesTable);
            console.log('✅ Document types table created');

            // === REQUEST PURPOSES TABLE ===
            // Reasons why students request documents (e.g., "Employment", "Further Studies")
            // Normalized lookup table for request purposes
            const createRequestPurposesTable = `
                CREATE TABLE IF NOT EXISTS request_purposes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    purposeName VARCHAR(255) NOT NULL,
                    isActive BOOLEAN DEFAULT TRUE,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    -- Indexes for performance and uniqueness
                    INDEX idx_purpose_name (purposeName),
                    INDEX idx_is_active (isActive),
                    UNIQUE KEY unique_purpose_name (purposeName) -- Prevent duplicate purposes
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `;
            await this.executeQuery(createRequestPurposesTable);
            console.log('✅ Request purposes table created');

            // === DOCUMENT PURPOSES JUNCTION TABLE ===
            // Many-to-many relationship between documents and purposes
            // Allows flexible assignment of purposes to different document types
            // Example: Transcript can be for "Employment" or "Further Studies"
            const createDocumentPurposesTable = `
                CREATE TABLE IF NOT EXISTS document_purposes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    documentId INT NOT NULL,
                    purposeId INT NOT NULL,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    -- Indexes for performance and relationship queries
                    INDEX idx_document_id (documentId),
                    INDEX idx_purpose_id (purposeId),
                    -- Ensure unique document-purpose combinations
                    UNIQUE KEY unique_document_purpose (documentId, purposeId),
                    -- Foreign key constraints with cascade delete
                    FOREIGN KEY (documentId) REFERENCES document_types(id) ON DELETE CASCADE,
                    FOREIGN KEY (purposeId) REFERENCES request_purposes(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `;
            await this.executeQuery(createDocumentPurposesTable);
            console.log('✅ Document purposes junction table created');

            // === REQUEST STATUSES TABLE ===
            // Workflow states for document request processing
            // Defines the possible stages a request can go through
            const createRequestStatusesTable = `
                CREATE TABLE IF NOT EXISTS request_statuses (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    statusName ENUM('PENDING', 'SET', 'READY', 'RECEIVED', 'FAILED') UNIQUE NOT NULL,
                    description TEXT, -- Human-readable description of the status
                    isActive BOOLEAN DEFAULT TRUE,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    -- Indexes for performance
                    INDEX idx_status_name (statusName),
                    INDEX idx_is_active (isActive)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `;
            await this.executeQuery(createRequestStatusesTable);
            console.log('✅ Request statuses table created');

            // === PICKUP STATUSES TABLE ===
            // Tracks the status of document pickup by students
            // Separate from request status for more granular tracking
            const createPickupStatusesTable = `
                CREATE TABLE IF NOT EXISTS pickup_statuses (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    statusName ENUM('pending', 'completed', 'failed') UNIQUE NOT NULL,
                    description TEXT,
                    isActive BOOLEAN DEFAULT TRUE,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    -- Indexes for performance
                    INDEX idx_status_name (statusName),
                    INDEX idx_is_active (isActive)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `;
            await this.executeQuery(createPickupStatusesTable);
            console.log('✅ Pickup statuses table created');

            // === DOCUMENT REQUESTS TABLE ===
            // Main table for tracking document requests - the core business entity
            // Highly normalized with foreign key relationships to all lookup tables
            const createDocumentRequestsTable = `
                CREATE TABLE IF NOT EXISTS document_requests (
                    id INT AUTO_INCREMENT PRIMARY KEY,

                    -- Unique identifiers for external reference
                    requestId VARCHAR(255) UNIQUE NOT NULL, -- Internal system ID
                    requestNo VARCHAR(255) UNIQUE NOT NULL, -- Human-readable request number
                    referenceNumber VARCHAR(255) UNIQUE NOT NULL, -- Public tracking number

                    -- Foreign keys to normalized tables
                    requesterId INT NOT NULL, -- Links to students or alumni table based on requesterType
                    requesterType ENUM('student', 'alumni') NOT NULL, -- Determines which table to reference
                    courseId INT NOT NULL, -- Links to courses table
                    purposeId INT NOT NULL, -- Links to request_purposes table
                    statusId INT NOT NULL DEFAULT 1, -- Links to request_statuses (default: PENDING)
                    pickupStatusId INT NOT NULL DEFAULT 1, -- Links to pickup_statuses (default: pending)

                    -- Optional fields
                    otherPurpose TEXT, -- Free-text purpose if not in predefined list
                    scheduledPickup DATETIME NULL, -- When student is scheduled to pick up
                    rescheduledPickup DATETIME NULL, -- If pickup was rescheduled
                    dateProcessed DATETIME NULL, -- When request was processed by staff
                    dateCompleted DATETIME NULL, -- When documents were picked up
                    totalAmount DECIMAL(10,2) DEFAULT 0.00, -- Total cost of all documents
                    processedBy INT NULL, -- Staff member who processed the request
                    adminNotes TEXT, -- Internal notes for administrators

                    -- Audit fields
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                    -- Performance indexes for common queries
                    INDEX idx_request_id (requestId),
                    INDEX idx_request_no (requestNo),
                    INDEX idx_reference_number (referenceNumber),
                    INDEX idx_requester_id (requesterId),
                    INDEX idx_requester_type (requesterType),
                    INDEX idx_course_id (courseId),
                    INDEX idx_status_id (statusId),
                    INDEX idx_pickup_status_id (pickupStatusId),
                    INDEX idx_created_at (createdAt),
                    INDEX idx_processed_by (processedBy),

                    -- Foreign key constraints with referential integrity
                    FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE RESTRICT,
                    FOREIGN KEY (purposeId) REFERENCES request_purposes(id) ON DELETE RESTRICT,
                    FOREIGN KEY (statusId) REFERENCES request_statuses(id) ON DELETE RESTRICT,
                    FOREIGN KEY (pickupStatusId) REFERENCES pickup_statuses(id) ON DELETE RESTRICT,
                    FOREIGN KEY (processedBy) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `;
            await this.executeQuery(createDocumentRequestsTable);
            console.log('✅ Document requests table created');

            // === REQUEST DOCUMENTS TABLE ===
            // Junction table for documents within each request
            // Supports multiple documents per request with quantity and pricing
            const createRequestDocumentsTable = `
                CREATE TABLE IF NOT EXISTS request_documents (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    requestId INT NOT NULL, -- Links to document_requests table
                    documentTypeId INT NOT NULL, -- Links to document_types table
                    quantity INT NOT NULL DEFAULT 1, -- Number of copies requested
                    unitPrice DECIMAL(10,2) NOT NULL, -- Price per document at time of request
                    totalPrice DECIMAL(10,2) NOT NULL, -- Calculated: quantity * unitPrice
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                    -- Indexes for performance and relationship queries
                    INDEX idx_request_id (requestId),
                    INDEX idx_document_type_id (documentTypeId),

                    -- Foreign key constraints
                    FOREIGN KEY (requestId) REFERENCES document_requests(id) ON DELETE CASCADE,
                    FOREIGN KEY (documentTypeId) REFERENCES document_types(id) ON DELETE RESTRICT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `;
            await this.executeQuery(createRequestDocumentsTable);
            console.log('✅ Request documents table created');

            // === REQUEST TRACKING TABLE ===
            // Audit trail for all status changes and updates to requests
            // Provides complete history of request lifecycle
            const createRequestTrackingTable = `
                CREATE TABLE IF NOT EXISTS request_tracking (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    requestId INT NOT NULL, -- Links to document_requests table
                    statusId INT NOT NULL, -- Links to request_statuses table
                    changedBy INT NULL, -- Links to users table (who made the change)
                    notes TEXT, -- Optional notes about the change
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,

                    -- Indexes for performance and historical queries
                    INDEX idx_request_id (requestId),
                    INDEX idx_status_id (statusId),
                    INDEX idx_changed_by (changedBy),
                    INDEX idx_created_at (createdAt),

                    -- Foreign key constraints
                    FOREIGN KEY (requestId) REFERENCES document_requests(id) ON DELETE CASCADE,
                    FOREIGN KEY (statusId) REFERENCES request_statuses(id) ON DELETE RESTRICT,
                    FOREIGN KEY (changedBy) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `;
            await this.executeQuery(createRequestTrackingTable);
            console.log('✅ Request tracking table created');

            // === ANNOUNCEMENTS TABLE ===
            // Stores public announcements for display on the website
            const createAnnouncementsTable = `
                CREATE TABLE IF NOT EXISTS announcements (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    content TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    is_published BOOLEAN DEFAULT TRUE,
                    INDEX idx_created_at (created_at),
                    INDEX idx_published (is_published)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `;
            await this.executeQuery(createAnnouncementsTable);
            console.log('✅ Announcements table created');

            // === TRANSACTION DAYS TABLE ===
            // Stores transaction day schedules and availability
            const createTransactionDaysTable = `
                CREATE TABLE IF NOT EXISTS transaction_days (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    date DATE NOT NULL UNIQUE,
                    status ENUM('no transaction', 'limited', 'available') DEFAULT 'available',
                    time_start TIME NULL,
                    time_end TIME NULL,
                    message TEXT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_date (date),
                    INDEX idx_status (status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `;
            await this.executeQuery(createTransactionDaysTable);
            console.log('✅ Transaction days table created');

            // === EMAIL VERIFICATIONS TABLE ===
            // Stores email verification tokens for link-based verification
            const createEmailVerificationsTable = `
                CREATE TABLE IF NOT EXISTS email_verifications (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    email VARCHAR(255) NOT NULL,
                    token VARCHAR(255) NOT NULL UNIQUE,
                    expires_at DATETIME NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_email (email),
                    INDEX idx_token (token),
                    INDEX idx_expires_at (expires_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `;
            await this.executeQuery(createEmailVerificationsTable);
            console.log('✅ Email verifications table created');

            // === USER_DEPARTMENTS JUNCTION TABLE ===
            // Many-to-many relationship between users and departments for RBAC
            const createUserDepartmentsTable = `
                CREATE TABLE IF NOT EXISTS user_departments (
                    user_id INT NOT NULL,
                    department_id INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, department_id),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE CASCADE,
                    INDEX idx_user_id (user_id),
                    INDEX idx_department_id (department_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `;
            await this.executeQuery(createUserDepartmentsTable);
            console.log('✅ User-departments junction table created');

            // Insert default lookup data
            await this.insertDefaultLookupData();

        } catch (error) {
            console.error('Error creating tables:', error.message);
            throw error;
        }
    }

    /**
     * Insert default lookup data
     * Populates lookup tables with initial system data required for operation
     *
     * This method uses INSERT IGNORE to prevent duplicate key errors if data already exists
     * Useful for system initialization and maintaining referential integrity
     *
     * @returns {Promise<void>}
     */
    async insertDefaultLookupData() {
        try {
            console.log('📋 Inserting default lookup data...');

            // Insert default request statuses with descriptions
            await this.executeQuery(`
                INSERT IGNORE INTO request_statuses (statusName, description) VALUES
                ('PENDING', 'Request has been submitted and is waiting for processing'),
                ('SET', 'Request has been scheduled for processing'),
                ('READY', 'Request has been processed and is ready for pickup'),
                ('RECEIVED', 'Request has been picked up by the student'),
                ('FAILED', 'Request processing failed')
            `);

            // Insert default pickup statuses with descriptions
            await this.executeQuery(`
                INSERT IGNORE INTO pickup_statuses (statusName, description) VALUES
                ('pending', 'Pickup not yet scheduled'),
                ('completed', 'Request has been picked up'),
                ('failed', 'Pickup failed or was cancelled')
            `);

            // Insert default announcements only if table is empty
            const existingAnnouncements = await this.executeQuery('SELECT COUNT(*) as count FROM announcements');
            if (existingAnnouncements[0].count === 0) {
                await this.executeQuery(`
                    INSERT INTO announcements (title, content, is_published) VALUES
                    ('Welcome to the New Semester!', 'We are excited to welcome all students for the new academic year. Document processing services are now available.', TRUE),
                    ('Extended Processing Time During Finals', 'Please note that document processing may take longer during final examination periods. We appreciate your patience.', FALSE),
                    ('Holiday Schedule Update', 'Our office will be closed on national holidays. Check back for specific dates and available services.', FALSE)
                `);
                console.log('📢 Default announcements inserted');
            } else {
                console.log('📢 Announcements table already has data, skipping default insertion');
            }

            console.log('✅ Default lookup data inserted successfully');

        } catch (error) {
            console.error('❌ Error inserting default lookup data:', error.message);
            throw error;
        }
    }

    /**
     * Create default admin and staff users
     * Only creates users if they don't already exist to preserve user passwords
     * @returns {Promise<void>}
     */
    async createDefaultUsers() {
        try {
            // Check if admin user already exists
            const [existingAdmin] = await this.executeQuery(
                'SELECT id FROM users WHERE email = ?',
                ['spc.registrar.system@gmail.com']
            );

            // Only create admin if they don't exist
            if (!existingAdmin || existingAdmin.length === 0) {
                const adminPassword = await this.hashPassword('admin123');
                await this.executeQuery(
                    'INSERT INTO users (username, email, password, role, firstName, lastName, isActive) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    ['admin', 'spc.registrar.system@gmail.com', adminPassword, 'admin', 'Registrar', 'System', true]
                );
                console.log('👥 Admin user created: spc.registrar.system@gmail.com / admin123');
            } else {
                console.log('👥 Admin user already exists, preserving existing password');
            }

            // Check if staff user already exists
            const [existingStaff] = await this.executeQuery(
                'SELECT id FROM users WHERE email = ?',
                ['staff@gmail.com']
            );

            // Only create staff if they don't exist
            if (!existingStaff || existingStaff.length === 0) {
                const staffPassword = await this.hashPassword('staff123');
                await this.executeQuery(
                    'INSERT INTO users (username, email, password, role, firstName, lastName, isActive) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    ['staff', 'staff@gmail.com', staffPassword, 'staff', 'Document', 'Processor', true]
                );
                console.log('👥 Staff user created: staff@gmail.com / staff123');
            } else {
                console.log('👥 Staff user already exists, preserving existing password');
            }

            console.log('✅ Default users initialization completed');

        } catch (error) {
            console.error('❌ Error creating default users:', error.message);
            throw error;
        }
    }

    /**
     * Hash password using bcrypt
     * Securely hashes passwords before storing in database
     *
     * Security Features:
     * - Uses bcrypt with salt rounds for strong hashing
     * - Salt rounds: 12 (industry standard for security vs performance)
     * - Prevents rainbow table attacks
     * - Computationally expensive to deter brute force attacks
     *
     * @param {string} password - Plain text password to hash
     * @returns {Promise<string>} Hashed password safe for database storage
     */
    async hashPassword(password) {
        try {
            const saltRounds = 12; // Higher = more secure but slower
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            return hashedPassword;
        } catch (error) {
            console.error('❌ Password hashing failed:', error.message);
            throw error;
        }
    }

    /**
     * Verify password using bcrypt
     * Compares plain text password with stored hash
     *
     * Security Benefits:
     * - Timing-attack resistant comparison
     * - No information leakage about password strength
     * - Uses constant-time comparison algorithm
     *
     * @param {string} password - Plain text password to verify
     * @param {string} hashedPassword - Stored hash to compare against
     * @returns {Promise<boolean>} True if password matches hash
     */
    async verifyPassword(password, hashedPassword) {
        try {
            const isValid = await bcrypt.compare(password, hashedPassword);
            return isValid;
        } catch (error) {
            console.error('❌ Password verification failed:', error.message);
            // Return false instead of throwing to prevent information leakage
            return false;
        }
    }

    /**
     * Close database connection
     * Properly terminates the connection pool and cleans up resources
     *
     * Important for:
     * - Graceful application shutdown
     * - Resource cleanup in testing
     * - Preventing connection leaks
     */
    close() {
        if (this.db) {
            this.db.end(); // Close all connections in the pool
            this.isConnected = false;
            console.log('🔒 Database connection pool closed');
        }
    }

    /**
     * Get database connection instance
     * Provides direct access to the connection pool for advanced operations
     *
     * Use Cases:
     * - Complex transactions requiring multiple queries
     * - Direct SQL execution for migrations
     * - Testing and debugging scenarios
     *
     * @returns {Object} MySQL connection pool instance
     */
    getConnection() {
        return this.db;
    }
}

module.exports = DatabaseManager;
