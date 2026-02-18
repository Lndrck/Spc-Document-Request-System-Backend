-- Fix script to add missing DECLINE status to existing databases
-- This script should be run on databases that were set up before the DECLINE status was added

USE document_request_db;

-- Check if DECLINE status already exists
SELECT 'Checking for existing DECLINE status...' as message;
SELECT COUNT(*) as decline_count FROM request_statuses WHERE statusName = 'DECLINE';

-- Add DECLINE status if it doesn't exist
INSERT IGNORE INTO request_statuses (statusName, description)
VALUES ('DECLINE', 'Request has been declined or rejected');

-- Verify the status was added
SELECT 'DECLINE status verification' as message;
SELECT id, statusName, description FROM request_statuses WHERE statusName = 'DECLINE';

-- Show all statuses for verification
SELECT 'All request statuses after fix' as message;
SELECT id, statusName, description FROM request_statuses ORDER BY id;

-- Check if any existing requests should have DECLINE status
-- (This would be requests that were manually set to a declined state)
SELECT 'Checking for requests that might need DECLINE status' as message;
SELECT COUNT(*) as requests_that_might_be_declined
FROM document_requests dr
JOIN request_statuses rs ON dr.statusId = rs.id
WHERE rs.statusName IN ('FAILED', 'PENDING')  -- Common statuses that might actually be declines
AND dr.adminNotes LIKE '%decline%'
OR dr.adminNotes LIKE '%reject%';

-- Note: Any requests that were previously "declined" but stored as FAILED or other statuses
-- would need to be manually updated to use the new DECLINE status