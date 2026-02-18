-- Migration Script: Normalize document_requests table to 3NF
-- This script will create new normalized tables and migrate existing data

USE document_request_db;

-- Start transaction for data safety
START TRANSACTION;

-- 1. Create STUDENTS table (3NF - eliminates student data redundancy)
CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    studentNumber VARCHAR(255) UNIQUE NOT NULL,
    spcEmail VARCHAR(255) UNIQUE NOT NULL,
    surname VARCHAR(255) NOT NULL,
    firstName VARCHAR(255) NOT NULL,
    middleInitial VARCHAR(255),
    contactNo VARCHAR(255) NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_student_number (studentNumber),
    INDEX idx_spc_email (spcEmail),
    INDEX idx_surname (surname)
);

-- 2. Create COURSES table (3NF - eliminates course data redundancy)
CREATE TABLE IF NOT EXISTS courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    courseName VARCHAR(255) UNIQUE NOT NULL,
    educationalLevel VARCHAR(255),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_course_name (courseName)
);

-- 3. Create DOCUMENT_TYPES table (3NF - eliminates document type redundancy)
CREATE TABLE IF NOT EXISTS document_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    documentName VARCHAR(255) UNIQUE NOT NULL,
    basePrice DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    isActive BOOLEAN DEFAULT TRUE,
    year_options JSON DEFAULT '[]',
    sem_options JSON DEFAULT '[]',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_document_name (documentName),
    INDEX idx_is_active (isActive)
);

-- 4. Create REQUEST_PURPOSES table (3NF - eliminates purpose redundancy)
CREATE TABLE IF NOT EXISTS request_purposes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purposeName VARCHAR(255) UNIQUE NOT NULL,
    isActive BOOLEAN DEFAULT TRUE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_purpose_name (purposeName),
    INDEX idx_is_active (isActive)
);

-- 5. Create REQUEST_STATUSES table (3NF - eliminates status redundancy)
CREATE TABLE IF NOT EXISTS request_statuses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    statusName ENUM('PENDING', 'SET', 'PROCESSING', 'READY', 'RECEIVED', 'DECLINE') UNIQUE NOT NULL,
    description TEXT,
    isActive BOOLEAN DEFAULT TRUE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status_name (statusName),
    INDEX idx_is_active (isActive)
);

-- 6. Create PICKUP_STATUSES table (3NF - eliminates pickup status redundancy)
CREATE TABLE IF NOT EXISTS pickup_statuses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    statusName ENUM('pending', 'completed', 'failed') UNIQUE NOT NULL,
    description TEXT,
    isActive BOOLEAN DEFAULT TRUE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status_name (statusName),
    INDEX idx_is_active (isActive)
);


-- 8. Create DOCUMENT_REQUESTS table (normalized main table)
CREATE TABLE IF NOT EXISTS document_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    requestId VARCHAR(255) UNIQUE NOT NULL,
    requestNo VARCHAR(255) UNIQUE NOT NULL,
    referenceNumber VARCHAR(255) UNIQUE NOT NULL,
    studentId INT NOT NULL,
    courseId INT NOT NULL,
    purposeId INT NOT NULL,
    statusId INT NOT NULL DEFAULT 1, -- Default to PENDING
    pickupStatusId INT NOT NULL DEFAULT 1, -- Default to pending
    otherPurpose TEXT,
    scheduledPickup DATETIME NULL,
    rescheduledPickup DATETIME NULL,
    dateProcessed DATETIME NULL,
    dateCompleted DATETIME NULL,
    totalAmount DECIMAL(10,2) DEFAULT 0.00,
    processedBy INT NULL,
    adminNotes TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_request_id (requestId),
    INDEX idx_request_no (requestNo),
    INDEX idx_reference_number (referenceNumber),
    INDEX idx_student_id (studentId),
    INDEX idx_course_id (courseId),
    INDEX idx_status_id (statusId),
    INDEX idx_created_at (createdAt),
    FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE RESTRICT,
    FOREIGN KEY (purposeId) REFERENCES request_purposes(id) ON DELETE RESTRICT,
    FOREIGN KEY (statusId) REFERENCES request_statuses(id) ON DELETE RESTRICT,
    FOREIGN KEY (pickupStatusId) REFERENCES pickup_statuses(id) ON DELETE RESTRICT,
    FOREIGN KEY (processedBy) REFERENCES users(id) ON DELETE SET NULL
);

-- 9. Create REQUEST_DOCUMENTS table (junction table for many-to-many relationship)
CREATE TABLE IF NOT EXISTS request_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    requestId INT NOT NULL,
    documentTypeId INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unitPrice DECIMAL(10,2) NOT NULL,
    totalPrice DECIMAL(10,2) NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_request_id (requestId),
    INDEX idx_document_type_id (documentTypeId),
    FOREIGN KEY (requestId) REFERENCES document_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (documentTypeId) REFERENCES document_types(id) ON DELETE RESTRICT
);

-- 10. Create REQUEST_TRACKING table (normalized tracking history)
CREATE TABLE IF NOT EXISTS request_tracking (
    id INT AUTO_INCREMENT PRIMARY KEY,
    requestId INT NOT NULL,
    statusId INT NOT NULL,
    changedBy INT NULL,
    notes TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_request_id (requestId),
    INDEX idx_status_id (statusId),
    INDEX idx_created_at (createdAt),
    FOREIGN KEY (requestId) REFERENCES document_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (statusId) REFERENCES request_statuses(id) ON DELETE RESTRICT,
    FOREIGN KEY (changedBy) REFERENCES users(id) ON DELETE SET NULL
);

-- Insert default lookup data
INSERT IGNORE INTO request_statuses (statusName, description) VALUES
('PENDING', 'Request has been submitted and is waiting for processing'),
('SET', 'Request has been scheduled for processing'),
('PROCESSING', 'Request is currently being processed'),
('READY', 'Request has been processed and is ready for pickup'),
('RECEIVED', 'Request has been picked up by the student'),
('DECLINE', 'Request has been declined or rejected'),
('FAILED', 'Request processing failed');

INSERT IGNORE INTO pickup_statuses (statusName, description) VALUES
('pending', 'Pickup not yet scheduled'),
('completed', 'Request has been picked up'),
('failed', 'Pickup failed or was cancelled');

-- Migrate existing data from old document_requests table
INSERT IGNORE INTO students (studentNumber, spcEmail, surname, firstName, middleInitial, contactNo)
SELECT DISTINCT
    studentNumber,
    spcEmail,
    surname,
    firstName,
    middleInitial,
    contactNo
FROM document_requests_old
WHERE studentNumber IS NOT NULL;

INSERT IGNORE INTO courses (courseName, educationalLevel)
SELECT DISTINCT
    course,
    educationalLevel
FROM document_requests_old
WHERE course IS NOT NULL;

INSERT IGNORE INTO request_purposes (purposeName)
SELECT DISTINCT
    purposeOfRequest
FROM document_requests_old
WHERE purposeOfRequest IS NOT NULL;

INSERT IGNORE INTO document_types (documentName, basePrice)
SELECT DISTINCT
    JSON_UNQUOTE(JSON_EXTRACT(CONCAT('[', REPLACE(REPLACE(documents, '[', ''), ']', ''), ']'), CONCAT('$[', nums.n, '].name'))) as doc_name,
    JSON_UNQUOTE(JSON_EXTRACT(CONCAT('[', REPLACE(REPLACE(documents, '[', ''), ']', ''), ']'), CONCAT('$[', nums.n, '].price'))) as doc_price
FROM document_requests_old
CROSS JOIN (
    SELECT 0 as n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
    UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
) nums
WHERE nums.n < JSON_LENGTH(CONCAT('[', REPLACE(REPLACE(documents, '[', ''), ']', ''), ']'))
  AND JSON_UNQUOTE(JSON_EXTRACT(CONCAT('[', REPLACE(REPLACE(documents, '[', ''), ']', ''), ']'), CONCAT('$[', nums.n, '].name'))) IS NOT NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(CONCAT('[', REPLACE(REPLACE(documents, '[', ''), ']', ''), ']'), CONCAT('$[', nums.n, '].price'))) IS NOT NULL;

-- Migrate main request data
INSERT INTO document_requests (
    requestId, requestNo, referenceNumber, studentId, courseId, purposeId,
    statusId, pickupStatusId, otherPurpose, scheduledPickup,
    rescheduledPickup, dateProcessed, dateCompleted, totalAmount, processedBy, adminNotes
)
SELECT
    dr.requestId,
    dr.requestNo,
    dr.referenceNumber,
    s.id as studentId,
    c.id as courseId,
    rp.id as purposeId,
    CASE dr.status
        WHEN 'PENDING' THEN 1
        WHEN 'SET' THEN 2
        WHEN 'READY' THEN 3
        WHEN 'RECEIVED' THEN 4
        WHEN 'DECLINE' THEN 5
        ELSE 1
    END as statusId,
    CASE dr.pickupStatus
        WHEN 'pending' THEN 1
        WHEN 'completed' THEN 2
        WHEN 'failed' THEN 3
        ELSE 1
    END as pickupStatusId,
    dr.otherPurpose,
    dr.scheduledPickup,
    dr.rescheduledPickup,
    dr.dateProcessed,
    dr.dateCompleted,
    dr.totalAmount,
    dr.processedBy,
    dr.adminNotes
FROM document_requests_old dr
JOIN students s ON dr.studentNumber = s.studentNumber
JOIN courses c ON dr.course = c.courseName
JOIN request_purposes rp ON dr.purposeOfRequest = rp.purposeName;

-- Migrate document details
INSERT INTO request_documents (requestId, documentTypeId, quantity, unitPrice, totalPrice)
SELECT
    dr_new.id as requestId,
    dt.id as documentTypeId,
    CAST(JSON_UNQUOTE(JSON_EXTRACT(CONCAT('[', REPLACE(REPLACE(dr_old.documents, '[', ''), ']', ''), ']'), CONCAT('$[', nums.n, '].quantity'))) AS UNSIGNED) as quantity,
    CAST(JSON_UNQUOTE(JSON_EXTRACT(CONCAT('[', REPLACE(REPLACE(dr_old.documents, '[', ''), ']', ''), ']'), CONCAT('$[', nums.n, '].price'))) AS DECIMAL(10,2)) as unitPrice,
    CAST(JSON_UNQUOTE(JSON_EXTRACT(CONCAT('[', REPLACE(REPLACE(dr_old.documents, '[', ''), ']', ''), ']'), CONCAT('$[', nums.n, '].price'))) AS DECIMAL(10,2)) *
    CAST(JSON_UNQUOTE(JSON_EXTRACT(CONCAT('[', REPLACE(REPLACE(dr_old.documents, '[', ''), ']', ''), ']'), CONCAT('$[', nums.n, '].quantity'))) AS UNSIGNED) as totalPrice
FROM document_requests_old dr_old
CROSS JOIN (
    SELECT 0 as n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
    UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
) nums
JOIN document_requests dr_new ON dr_old.requestId = dr_new.requestId
JOIN document_types dt ON JSON_UNQUOTE(JSON_EXTRACT(CONCAT('[', REPLACE(REPLACE(dr_old.documents, '[', ''), ']', ''), ']'), CONCAT('$[', nums.n, '].name'))) = dt.documentName
WHERE nums.n < JSON_LENGTH(CONCAT('[', REPLACE(REPLACE(dr_old.documents, '[', ''), ']', ''), ']'))
  AND JSON_UNQUOTE(JSON_EXTRACT(CONCAT('[', REPLACE(REPLACE(dr_old.documents, '[', ''), ']', ''), ']'), CONCAT('$[', nums.n, '].name'))) IS NOT NULL;

-- Migrate tracking history
INSERT INTO request_tracking (requestId, statusId, notes, createdAt)
SELECT
    dr_new.id as requestId,
    CASE JSON_UNQUOTE(JSON_EXTRACT(value, '$.status'))
        WHEN 'PENDING' THEN 1
        WHEN 'SET' THEN 2
        WHEN 'READY' THEN 3
        WHEN 'RECEIVED' THEN 4
        WHEN 'DECLINE' THEN 5
        ELSE 1
    END as statusId,
    JSON_UNQUOTE(JSON_EXTRACT(value, '$.message')) as notes,
    JSON_UNQUOTE(JSON_EXTRACT(value, '$.timestamp')) as createdAt
FROM document_requests_old dr_old
JOIN document_requests dr_new ON dr_old.requestId = dr_new.requestId
CROSS JOIN JSON_TABLE(
    CONCAT('[', REPLACE(REPLACE(dr_old.trackingHistory, '[', ''), ']', ''), ']'),
    '$[*]' COLUMNS (
        value JSON PATH '$'
    )
) as tracking_data;

-- Create a backup of the old table before dropping
CREATE TABLE IF NOT EXISTS document_requests_backup AS
SELECT * FROM document_requests_old;

-- Drop the old table
DROP TABLE IF EXISTS document_requests_old;

-- Commit the transaction
COMMIT;

-- Show migration results
SELECT 'Migration completed successfully!' as status;
SELECT
    (SELECT COUNT(*) FROM students) as students_count,
    (SELECT COUNT(*) FROM courses) as courses_count,
    (SELECT COUNT(*) FROM document_types) as document_types_count,
    (SELECT COUNT(*) FROM request_purposes) as purposes_count,
    (SELECT COUNT(*) FROM document_requests) as requests_count,
    (SELECT COUNT(*) FROM request_documents) as request_documents_count,
    (SELECT COUNT(*) FROM request_tracking) as tracking_count;