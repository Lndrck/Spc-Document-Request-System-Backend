-- Allow NULL for school_year and request_semester in document_requests for alumni
-- School year and semester are stored at the request level, not at document level

ALTER TABLE document_requests
MODIFY COLUMN school_year VARCHAR(20) NULL COMMENT 'School year (can be NULL for alumni)',
MODIFY COLUMN request_semester VARCHAR(20) NULL COMMENT 'Request semester (can be NULL for alumni)';

-- Remove year and semester columns from request_documents if they were added
ALTER TABLE request_documents
DROP COLUMN IF EXISTS year,
DROP COLUMN IF EXISTS semester;
