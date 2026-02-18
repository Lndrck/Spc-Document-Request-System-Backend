-- 2026-02-02: Backfill user_departments and drop legacy users.department_id
-- UP: apply migration
START TRANSACTION;

-- 1) Backfill junction table from legacy column (no-op for rows already present)
INSERT IGNORE INTO user_departments (user_id, department_id)
SELECT id, department_id
FROM users
WHERE department_id IS NOT NULL;

-- 2) Drop legacy column with foreign key constraint
-- First, we need to drop the foreign key constraint that was added with the column
-- Disable foreign key checks, drop the foreign key (if exists), then drop the column
SET FOREIGN_KEY_CHECKS = 0;
ALTER TABLE users DROP FOREIGN KEY IF EXISTS users_ibfk_1;
ALTER TABLE users DROP INDEX IF EXISTS department_id;
ALTER TABLE users DROP COLUMN IF EXISTS department_id;
SET FOREIGN_KEY_CHECKS = 1;

COMMIT;

-- ========================
-- DOWN: rollback migration (recreate legacy column and repopulate)
-- Use only if you need to restore the old single-column design.
START TRANSACTION;

-- 1) Recreate column (nullable)
ALTER TABLE users ADD COLUMN department_id INT NULL;

-- 2) Populate with a single department per user.
-- If a user belongs to multiple departments, this chooses the smallest department_id.
UPDATE users u
JOIN (
  SELECT user_id, MIN(department_id) AS dept_id
  FROM user_departments
  GROUP BY user_id
) ud ON u.id = ud.user_id
SET u.department_id = ud.dept_id;

COMMIT;
