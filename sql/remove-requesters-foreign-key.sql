-- Script to remove the foreign key constraint that references the dropped requesters table

USE document_request_db;

-- Remove the foreign key constraint that references requesters table
SET @fk_name = (
    SELECT CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_NAME = 'document_requests'
    AND COLUMN_NAME = 'studentId'
    AND REFERENCED_TABLE_NAME = 'requesters'
    LIMIT 1
);

-- Drop the foreign key if it exists
SET @sql = IF(@fk_name IS NOT NULL,
    CONCAT('ALTER TABLE document_requests DROP FOREIGN KEY ', @fk_name),
    'SELECT "No requesters foreign key found" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Also drop the studentId column if it still exists and we want to use requesterId/requesterType
-- But for now, let's keep it to avoid breaking existing data

SELECT 'Foreign key removal completed!' as status;