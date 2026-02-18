-- Migration: Add school_year and request_semester columns to document_requests table
-- This migration adds academic tracking fields to document requests

-- Check if school_year column exists before adding
SELECT COUNT(*) INTO @exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'document_requests' 
  AND COLUMN_NAME = 'school_year';

SET @sql = IF(@exists = 0, 
    'ALTER TABLE document_requests ADD COLUMN school_year VARCHAR(20) DEFAULT NULL AFTER totalAmount',
    'SELECT ''school_year column already exists'' as status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check if request_semester column exists before adding
SELECT COUNT(*) INTO @exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'document_requests' 
  AND COLUMN_NAME = 'request_semester';

SET @sql = IF(@exists = 0, 
    'ALTER TABLE document_requests ADD COLUMN request_semester VARCHAR(20) DEFAULT NULL AFTER school_year',
    'SELECT ''request_semester column already exists'' as status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create index for faster lookups by academic term (skip if index already exists)
CREATE INDEX IF NOT EXISTS idx_document_requests_school_year ON document_requests(school_year);
CREATE INDEX IF NOT EXISTS idx_document_requests_semester ON document_requests(request_semester);

-- Update existing records to set default values if needed
UPDATE document_requests
SET school_year = '2024-2025',
    request_semester = '1st Sem'
WHERE school_year IS NULL AND request_semester IS NULL;
