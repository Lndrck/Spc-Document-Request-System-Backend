-- Migration script to update existing courses with department_id based on educationalLevel
-- Run this in your SQL tab (e.g., phpMyAdmin, MySQL Workbench)

-- 1. Update Basic Education courses (Kinder) - department_id = 4
UPDATE courses 
SET department_id = 4 
WHERE educationalLevel = 'Basic Education' 
  AND (department_id IS NULL OR department_id = 0);

-- 2. Update Elementary courses (Grade 1-6) - department_id = 5
UPDATE courses 
SET department_id = 5 
WHERE educationalLevel = 'Elementary' 
  AND (department_id IS NULL OR department_id = 0);

-- 3. Update High School courses (Grade 7-10) - department_id = 6
UPDATE courses 
SET department_id = 6 
WHERE educationalLevel = 'High School' 
  AND (department_id IS NULL OR department_id = 0);

-- Verification query: Check which courses still need department_id
SELECT 
    id,
    courseName,
    educationalLevel,
    department_id,
    CASE 
        WHEN educationalLevel = 'Basic Education' THEN 4
        WHEN educationalLevel = 'Elementary' THEN 5
        WHEN educationalLevel = 'High School' THEN 6
        ELSE NULL
    END AS suggested_department_id
FROM courses 
WHERE (department_id IS NULL OR department_id = 0)
  AND educationalLevel IN ('Basic Education', 'Elementary', 'High School');

-- Final verification: Count courses by department
SELECT 
    d.department_name,
    COUNT(c.id) AS course_count
FROM departments d
LEFT JOIN courses c ON d.department_id = c.department_id
WHERE d.department_id IN (4, 5, 6)
GROUP BY d.department_id, d.department_name
ORDER BY d.department_id;
