-- Safe removal of duplicate department (id = 12) with foreign key integrity
-- Execute these queries in order to safely remove duplicate department

-- STEP 1: Check current references to department_id = 12
-- Check users table (has foreign key constraint)
SELECT COUNT(*) as users_count FROM users WHERE department_id = 12;

-- Check students table
SELECT COUNT(*) as students_count FROM students WHERE department_id = 12;

-- Check alumni table
SELECT COUNT(*) as alumni_count FROM alumni WHERE department_id = 12;

-- Check document_requests table
SELECT COUNT(*) as requests_count FROM document_requests WHERE department_id = 12;

-- STEP 2: Verify the duplicate department exists and find the valid one
SELECT id, name FROM departments WHERE name = 'College of Computer Studies';
-- This should show id=1 (valid) and id=12 (duplicate)

-- STEP 3: Reassign all references from id=12 to id=1
-- IMPORTANT: Only run these if the above counts show references exist

-- Reassign users (this will work due to foreign key)
UPDATE users SET department_id = 1 WHERE department_id = 12;

-- Reassign students
UPDATE students SET department_id = 1 WHERE department_id = 12;

-- Reassign alumni
UPDATE alumni SET department_id = 1 WHERE department_id = 12;

-- Reassign document requests
UPDATE document_requests SET department_id = 1 WHERE department_id = 12;

-- STEP 4: Verify all references have been reassigned
SELECT COUNT(*) as remaining_refs FROM (
    SELECT department_id FROM users WHERE department_id = 12
    UNION ALL
    SELECT department_id FROM students WHERE department_id = 12
    UNION ALL
    SELECT department_id FROM alumni WHERE department_id = 12
    UNION ALL
    SELECT department_id FROM document_requests WHERE department_id = 12
) as refs;

-- STEP 5: Delete the duplicate department
DELETE FROM departments WHERE id = 12;

-- STEP 6: Verify deletion
SELECT id, name FROM departments WHERE name = 'College of Computer Studies';
-- Should now only show id=1

-- STEP 7: Add unique constraint to prevent future duplicates
ALTER TABLE departments ADD UNIQUE (name);

-- STEP 8: Verify constraint works (optional test)
-- This should fail if you try to insert a duplicate:
-- INSERT INTO departments (name) VALUES ('College of Computer Studies');
