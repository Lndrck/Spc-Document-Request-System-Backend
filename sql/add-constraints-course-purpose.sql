-- Add NOT NULL constraints to courseId and purposeId in document_requests table
-- This ensures that all requests have valid course and purpose references

USE document_request_db;

-- First, backfill any NULL values with default values
UPDATE document_requests
SET courseId = (SELECT id FROM courses WHERE courseName = 'Not Applicable' LIMIT 1)
WHERE courseId IS NULL;

UPDATE document_requests
SET purposeId = (SELECT id FROM request_purposes WHERE purposeName = 'Not Specified' LIMIT 1)
WHERE purposeId IS NULL;

-- Add NOT NULL constraints
ALTER TABLE document_requests
MODIFY courseId INT NOT NULL;

ALTER TABLE document_requests
MODIFY purposeId INT NOT NULL;

-- Verify the constraints were added
SELECT 'Constraints added successfully' as status;