-- Backfill NULL courseId and purposeId in document_requests
-- First, insert default course if not exists
INSERT IGNORE INTO courses (courseName, educationalLevel) VALUES ('Not Applicable', NULL);

-- First, insert default purpose if not exists
INSERT IGNORE INTO request_purposes (purposeName, otherPurpose) VALUES ('Not Specified', NULL);

-- Update NULL courseId to default
SET @default_course_id = (SELECT id FROM courses WHERE courseName = 'Not Applicable' LIMIT 1);
UPDATE document_requests SET courseId = @default_course_id WHERE courseId IS NULL;

-- Update NULL purposeId to default
SET @default_purpose_id = (SELECT id FROM request_purposes WHERE purposeName = 'Not Specified' LIMIT 1);
UPDATE document_requests SET purposeId = @default_purpose_id WHERE purposeId IS NULL;