-- ========================================
-- SQL Script: Insert Grade Levels (K-10) into courses table
-- Run this in your SQL tab (phpMyAdmin or similar)
-- ========================================

-- 1. Insert Kinder (Basic Education Department - department_id = 4)
INSERT INTO `courses` (`courseName`, `educationalLevel`, `department_id`) 
VALUES ('Kinder', 'Basic Education', 4);

-- 2. Insert Grade School (Grade 1 to 6) - department_id = 5
INSERT INTO `courses` (`courseName`, `educationalLevel`, `department_id`) VALUES 
('Grade 1', 'Elementary', 5),
('Grade 2', 'Elementary', 5),
('Grade 3', 'Elementary', 5),
('Grade 4', 'Elementary', 5),
('Grade 5', 'Elementary', 5),
('Grade 6', 'Elementary', 5);

-- 3. Insert Junior High (Grade 7 to 10) - department_id = 6
INSERT INTO `courses` (`courseName`, `educationalLevel`, `department_id`) VALUES 
('Grade 7', 'High School', 6),
('Grade 8', 'High School', 6),
('Grade 9', 'High School', 6),
('Grade 10', 'High School', 6);

-- ========================================
-- Verify the inserted data
-- ========================================
SELECT 
    c.id,
    c.courseName,
    c.educationalLevel,
    d.department_name
FROM courses c
LEFT JOIN departments d ON c.department_id = d.department_id
WHERE c.id >= (SELECT MAX(id) FROM courses) - 10
ORDER BY c.id DESC;
