-- Backfill dateCompleted for existing RECEIVED requests
-- This migration sets dateCompleted = updatedAt for all requests that are currently RECEIVED
-- but don't have a dateCompleted set yet

UPDATE document_requests dr
JOIN request_statuses rs ON dr.statusId = rs.id
SET dr.dateCompleted = dr.updatedAt
WHERE rs.statusName = 'RECEIVED'
AND dr.dateCompleted IS NULL;

-- Optional: Add a comment to document this migration
-- This ensures that existing RECEIVED requests are properly counted in statistics
-- by having a valid dateCompleted timestamp