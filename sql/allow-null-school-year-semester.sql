-- Migration: Allow NULL for school_year and request_semester for Alumni
-- This allows alumni to submit requests without providing school year and semester
-- which are only applicable to current students

ALTER TABLE document_requests
MODIFY COLUMN school_year VARCHAR(20) NULL,
MODIFY COLUMN request_semester VARCHAR(20) NULL;

-- Verify the changes
DESCRIBE document_requests;
