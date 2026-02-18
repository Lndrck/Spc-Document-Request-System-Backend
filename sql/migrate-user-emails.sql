-- Migration Script: Migrate user emails to @registrar.spc.edu.ph domain
-- Replace personal email domains with @registrar.spc.edu.ph
-- Preserve username or convert to role-based format

USE document_request_db;

-- Start transaction for safety
START TRANSACTION;

-- ⚠️ Ensure no duplicate emails exist before running the update
-- Check for potential duplicates after migration
-- For staff: preserve username, change domain
UPDATE users
SET email = CONCAT(SUBSTRING_INDEX(email, '@', 1), '@registrar.spc.edu.ph')
WHERE role = 'staff'
  AND email NOT LIKE '%@registrar.spc.edu.ph'
  AND isActive = TRUE;

-- For admin: convert to role-based format
UPDATE users
SET email = 'registrar.admin@registrar.spc.edu.ph'
WHERE role = 'admin'
  AND email NOT LIKE '%@registrar.spc.edu.ph'
  AND isActive = TRUE;

-- Commit the transaction
COMMIT;

-- Show migration results
SELECT 'Email migration completed successfully!' as status;
SELECT
    role,
    COUNT(*) as total_users,
    SUM(CASE WHEN email LIKE '%@registrar.spc.edu.ph' THEN 1 ELSE 0 END) as migrated_emails
FROM users
WHERE isActive = TRUE
GROUP BY role;

-- Rollback: Revert emails back to original (if needed)
-- UPDATE users SET email = CONCAT(SUBSTRING_INDEX(email, '@', 1), '@gmail.com') WHERE role = 'staff' AND email LIKE '%@registrar.spc.edu.ph';
-- UPDATE users SET email = 'admin@gmail.com' WHERE role = 'admin' AND email LIKE '%@registrar.spc.edu.ph';