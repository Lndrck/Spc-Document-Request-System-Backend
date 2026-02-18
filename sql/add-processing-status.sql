-- Add PROCESSING status to existing request_statuses table
USE document_request_db;

-- First, modify the ENUM to include PROCESSING
ALTER TABLE request_statuses MODIFY COLUMN statusName ENUM('PENDING', 'SET', 'PROCESSING', 'READY', 'RECEIVED', 'DECLINE') UNIQUE NOT NULL;

-- Insert the PROCESSING status if it doesn't exist
INSERT IGNORE INTO request_statuses (statusName, description) VALUES
('PROCESSING', 'Request is currently being processed');

-- Show the updated statuses
SELECT id, statusName, description FROM request_statuses ORDER BY id;