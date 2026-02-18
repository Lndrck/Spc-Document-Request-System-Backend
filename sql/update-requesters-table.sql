-- Migration Script: Update students table to requesters with new fields
-- This script renames the table, updates column names, and adds requester type

USE document_request_db;

-- Start transaction for safety
START TRANSACTION;

-- 1. Rename table students to requesters
RENAME TABLE students TO requesters;

-- 2. Rename spcEmail column to email
ALTER TABLE requesters CHANGE spcEmail email VARCHAR(255) NOT NULL;

-- 3. Add requesterType column
ALTER TABLE requesters
ADD COLUMN requesterType ENUM('student', 'alumni') NOT NULL DEFAULT 'student';

-- 4. Update existing records to have requesterType = 'student' (since they were all students before)
UPDATE requesters SET requesterType = 'student' WHERE requesterType = 'student';

-- 5. Update foreign key constraint name and reference (if needed)
-- First, check if the foreign key exists and drop it
SET @fk_name = (
    SELECT CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_NAME = 'document_requests'
    AND COLUMN_NAME = 'studentId'
    AND REFERENCED_TABLE_NAME = 'students'
    LIMIT 1
);

-- Drop the old foreign key if it exists
SET @sql = IF(@fk_name IS NOT NULL, CONCAT('ALTER TABLE document_requests DROP FOREIGN KEY ', @fk_name), 'SELECT "No foreign key to drop"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add the new foreign key constraint
ALTER TABLE document_requests
ADD CONSTRAINT fk_document_requests_requester
FOREIGN KEY (studentId) REFERENCES requesters(id) ON DELETE CASCADE;

-- Commit the transaction
COMMIT;

-- Show migration results
SELECT 'Migration completed successfully!' as status;
SELECT
    (SELECT COUNT(*) FROM requesters) as requesters_count,
    (SELECT COUNT(*) FROM requesters WHERE requesterType = 'student') as students_count,
    (SELECT COUNT(*) FROM requesters WHERE requesterType = 'alumni') as alumni_count;