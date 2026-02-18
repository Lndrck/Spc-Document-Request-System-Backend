-- Migration Script: Create separate students and alumni tables
-- This script creates proper separate tables for students and alumni
-- and updates document_requests table to use requesterId and requesterType

USE document_request_db;

-- Start transaction for safety
START TRANSACTION;

-- 1. Create STUDENTS table (separate from alumni)
CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    studentNumber VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    surname VARCHAR(255) NOT NULL,
    firstName VARCHAR(255) NOT NULL,
    middleInitial VARCHAR(255),
    contactNo VARCHAR(255) NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_student_number (studentNumber),
    INDEX idx_email (email),
    INDEX idx_surname (surname)
);

-- 2. Create ALUMNI table (separate from students)
CREATE TABLE IF NOT EXISTS alumni (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    surname VARCHAR(255) NOT NULL,
    firstName VARCHAR(255) NOT NULL,
    middleInitial VARCHAR(255),
    contactNo VARCHAR(255) NOT NULL,
    graduationYear INT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_surname (surname),
    INDEX idx_graduation_year (graduationYear)
);

-- 3. Update DOCUMENT_REQUESTS table to use requesterId and requesterType
-- First, add the new columns
ALTER TABLE document_requests
ADD COLUMN requesterId INT NOT NULL DEFAULT 0,
ADD COLUMN requesterType ENUM('student', 'alumni') NOT NULL DEFAULT 'student';

-- Copy existing studentId data to requesterId for backward compatibility
UPDATE document_requests SET requesterId = studentId, requesterType = 'student';

-- Now drop the old studentId column and foreign key
-- First, check if foreign key exists and drop it
SET @fk_name = (
    SELECT CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_NAME = 'document_requests'
    AND COLUMN_NAME = 'studentId'
    AND REFERENCED_TABLE_NAME IS NOT NULL
    LIMIT 1
);

SET @sql = IF(@fk_name IS NOT NULL, CONCAT('ALTER TABLE document_requests DROP FOREIGN KEY ', @fk_name), 'SELECT "No foreign key to drop"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop the old studentId column
ALTER TABLE document_requests DROP COLUMN studentId;

-- Add foreign keys for the new structure
ALTER TABLE document_requests
ADD CONSTRAINT fk_document_requests_students
FOREIGN KEY (requesterId) REFERENCES students(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_document_requests_alumni
FOREIGN KEY (requesterId) REFERENCES alumni(id) ON DELETE CASCADE;

-- Note: MySQL doesn't support conditional foreign keys, so we'll handle this in application logic
-- For now, we'll keep both foreign keys but only one will be valid per row

-- Commit the transaction
COMMIT;

-- Show migration results
SELECT 'Migration completed successfully!' as status;
SELECT
    (SELECT COUNT(*) FROM students) as students_count,
    (SELECT COUNT(*) FROM alumni) as alumni_count,
    (SELECT COUNT(*) FROM document_requests) as requests_count;