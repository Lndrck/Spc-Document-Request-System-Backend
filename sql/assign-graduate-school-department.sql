-- Script to assign Graduate School department to staff
-- This script creates the Graduate School department if it doesn't exist
-- and assigns staff members to it

-- Step 1: Create Graduate School department if it doesn't exist
INSERT INTO departments (department_name)
SELECT 'Graduate School'
WHERE NOT EXISTS (
    SELECT 1 FROM departments WHERE department_name = 'Graduate School'
);

-- Step 2: Get the Graduate School department_id
SELECT department_id FROM departments WHERE department_name = 'Graduate School';

-- Step 3: Assign staff to Graduate School department
-- Replace 1 with the actual staff user_id you want to assign
-- Run this for each staff member:
-- INSERT INTO user_departments (user_id, department_id) VALUES (staff_user_id, graduate_school_dept_id);

-- Example: Assign user ID 621 (Damon) to Graduate School
-- First, get the department_id from Step 2 result, then run:
-- INSERT INTO user_departments (user_id, department_id) VALUES (621, X);

-- To check current staff assignments:
-- SELECT u.id, u.firstName, u.lastName, d.department_name
-- FROM users u
-- LEFT JOIN user_departments ud ON u.id = ud.user_id
-- LEFT JOIN departments d ON ud.department_id = d.department_id
-- WHERE u.role = 'staff';

-- To see all departments:
-- SELECT * FROM departments;
