-- Add year and semester columns to request_documents table for alumni document-level data
-- This allows storing the school year and semester at the document card level

ALTER TABLE request_documents
ADD COLUMN IF NOT EXISTS year VARCHAR(20) NULL COMMENT 'School year from document card (for alumni)',
ADD COLUMN IF NOT EXISTS semester VARCHAR(20) NULL COMMENT 'Semester from document card (for alumni)';

-- Also allow NULL for school_year and request_semester in document_requests for alumni
ALTER TABLE document_requests
MODIFY COLUMN school_year VARCHAR(20) NULL COMMENT 'School year (can be NULL for alumni)',
MODIFY COLUMN request_semester VARCHAR(20) NULL COMMENT 'Request semester (can be NULL for alumni)';
