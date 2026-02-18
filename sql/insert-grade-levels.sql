-- Insert Grade Levels into courses table
-- This script adds Kinder to Grade 10 courses linked to their respective departments

-- Department IDs:
-- ID 4: Basic Education Department (Kinder)
-- ID 5: Grade School Department (Grade 1-6)
-- ID 6: Junior High School Department (Grade 7-10)

-- 1. Insert Kinder (Basic Education)
INSERT INTO `courses` (`courseName`, `educationalLevel`, `department_id`) 
VALUES ('Kinder', 'Basic Education', 4);

-- 2. Insert Grade School (Grade 1 to 6)
INSERT INTO `courses` (`courseName`, `educationalLevel`, `department_id`) VALUES 
('Grade 1', 'Elementary', 5),
('Grade 2', 'Elementary', 5),
('Grade 3', 'Elementary', 5),
('Grade 4', 'Elementary', 5),
('Grade 5', 'Elementary', 5),
('Grade 6', 'Elementary', 5);

-- 3. Insert Junior High (Grade 7 to 10)
INSERT INTO `courses` (`courseName`, `educationalLevel`, `department_id`) VALUES 
('Grade 7', 'High School', 6),
('Grade 8', 'High School', 6),
('Grade 9', 'High School', 6),
('Grade 10', 'High School', 6);
