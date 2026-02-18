-- Migration Script: Update document_requests table to use requesterId and requesterType
-- This script updates the table structure to support separate students and alumni tables

USE document_request_db;

-- Start transaction for safety
START TRANSACTION;

-- 1. Add new columns
ALTER TABLE document_requests
ADD COLUMN requesterId INT NOT NULL AFTER requestId,
ADD COLUMN requesterType ENUM('student', 'alumni') NOT NULL AFTER requesterId;

-- 2. Copy data from studentId to requesterId (assuming all existing records are students)
UPDATE document_requests SET requesterId = studentId, requesterType = 'student';

-- 3. Drop the old foreign key constraint and index
-- First, find and drop the foreign key
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

-- Then drop the index if it exists
SET @index_name = (
    SELECT INDEX_NAME
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_NAME = 'document_requests'
    AND COLUMN_NAME = 'studentId'
    AND INDEX_NAME != 'PRIMARY'
    LIMIT 1
);

SET @sql2 = IF(@index_name IS NOT NULL, CONCAT('ALTER TABLE document_requests DROP INDEX ', @index_name), 'SELECT "No index to drop"');
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- 4. Drop the old studentId column
ALTER TABLE document_requests DROP COLUMN studentId;

-- 5. Add index for the new columns
ALTER TABLE document_requests
ADD INDEX idx_requester_id (requesterId),
ADD INDEX idx_requester_type (requesterType);

-- Commit the transaction
COMMIT;

-- Show migration results
SELECT 'Migration completed successfully!' as status;
SELECT
    (SELECT COUNT(*) FROM document_requests) as total_requests,
    (SELECT COUNT(*) FROM document_requests WHERE requesterType = 'student') as student_requests,
    (SELECT COUNT(*) FROM document_requests WHERE requesterType = 'alumni') as alumni_requests;