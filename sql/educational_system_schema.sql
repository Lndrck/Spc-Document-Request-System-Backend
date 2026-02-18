-- ============================================================================
-- EDUCATIONAL MANAGEMENT SYSTEM - MIGRATION SCRIPT
-- ============================================================================
-- This script updates the database schema to support:
-- 1. Multi-department staff assignments (many-to-many)
-- 2. Education level-based student department routing
-- 3. Course-department referential integrity
-- 4. Proper request routing for Kinder to Postgraduate students
--
-- Run this script once to apply all schema changes
-- ============================================================================

-- Start transaction
START TRANSACTION;

-- ============================================================================
-- STEP 1: Add new columns to departments table
-- ============================================================================
-- Add department_type and accepts_courses to track education levels

ALTER TABLE departments 
ADD COLUMN department_type ENUM('basic_education', 'grade_school', 'junior_high', 'senior_high', 'college', 'graduate_school') NOT NULL DEFAULT 'college' AFTER department_name,
ADD COLUMN accepts_courses BOOLEAN DEFAULT TRUE AFTER department_type;

-- Update department types based on education level
UPDATE departments SET department_type = 'basic_education', accepts_courses = FALSE WHERE department_name LIKE '%Basic Education%';
UPDATE departments SET department_type = 'grade_school', accepts_courses = FALSE WHERE department_name LIKE '%Grade School%';
UPDATE departments SET department_type = 'junior_high', accepts_courses = FALSE WHERE department_name LIKE '%Junior High%';
UPDATE departments SET department_type = 'senior_high', accepts_courses = TRUE WHERE department_name LIKE '%Senior High%';
UPDATE departments SET department_type = 'graduate_school', accepts_courses = TRUE WHERE department_name LIKE '%Graduate School%';

-- College departments
UPDATE departments SET department_type = 'college', accepts_courses = TRUE 
WHERE department_type = 'college' AND accepts_courses = TRUE;

-- ============================================================================
-- STEP 2: Add education level columns to courses table
-- ============================================================================

ALTER TABLE courses
ADD COLUMN educational_level ENUM('kinder', 'elementary', 'junior_high', 'senior_high', 'undergraduate', 'graduate', 'postgraduate') NOT NULL DEFAULT 'undergraduate' AFTER courseName;

-- Update existing courses with appropriate educational levels
UPDATE courses SET educational_level = 'senior_high' WHERE courseName IN ('Academic Track', 'GAS', 'GAS Strand', 'ABM', 'STEM', 'HUMSS');
UPDATE courses SET educational_level = 'undergraduate' WHERE courseName IN ('BSCS', 'BSIT', 'ACT', 'BA Comm', 'ABEL', 'AB PolSci', 'BS Mathematics', 'BS Psych', 'BSBA', 'BS Entrep', 'BS PubAd', 'BSREM', 'BSHM', 'BEED', 'BSED', 'BTLEd', 'BPED', 'BSNEd', 'CTP', 'BECEd', 'BSN', 'BSA', 'BSPT', 'BSRT', 'AradTech', 'J.D');
UPDATE courses SET educational_level = 'graduate' WHERE courseName IN ('M.A. Engl.', 'M.A. Fil.', 'M.A.C', 'MBA', 'DBA', 'MAEM', 'Ed.D', 'Ph.D', 'M.Ed', 'M.S.', 'M.S.Ed', 'MAN');

-- ============================================================================
-- STEP 3: Add education level columns to students table
-- ============================================================================

ALTER TABLE students
ADD COLUMN educational_level ENUM('kinder', 'elementary', 'junior_high', 'senior_high', 'undergraduate', 'graduate', 'postgraduate') NOT NULL DEFAULT 'undergraduate' AFTER contactNo,
ADD COLUMN grade_level INT NULL AFTER educational_level;

-- ============================================================================
-- STEP 4: Add education level columns to alumni table
-- ============================================================================

ALTER TABLE alumni
ADD COLUMN educational_level ENUM('kinder', 'elementary', 'junior_high', 'senior_high', 'undergraduate', 'graduate', 'postgraduate') NOT NULL DEFAULT 'undergraduate' AFTER graduationYear;

-- ============================================================================
-- STEP 5: Create helper function for education level to department mapping
-- ============================================================================

DELIMITER //

DROP FUNCTION IF EXISTS getDepartmentForStudent //
CREATE FUNCTION getDepartmentForStudent(p_educational_level VARCHAR(50), p_course_id INT) 
RETURNS INT
DETERMINISTIC
BEGIN
    DECLARE v_department_id INT DEFAULT NULL;
    
    -- Kinder to Junior High: return department based on level (no course needed)
    IF p_educational_level = 'kinder' THEN
        SELECT department_id INTO v_department_id FROM departments WHERE department_type = 'basic_education' LIMIT 1;
    ELSEIF p_educational_level = 'elementary' THEN
        SELECT department_id INTO v_department_id FROM departments WHERE department_type = 'grade_school' LIMIT 1;
    ELSEIF p_educational_level = 'junior_high' THEN
        SELECT department_id INTO v_department_id FROM departments WHERE department_type = 'junior_high' LIMIT 1;
    -- Senior High and College: require course
    ELSEIF p_educational_level IN ('senior_high', 'undergraduate', 'graduate', 'postgraduate') THEN
        IF p_course_id IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Course is required for this education level';
        END IF;
        SELECT department_id INTO v_department_id FROM courses WHERE id = p_course_id;
    END IF;
    
    RETURN v_department_id;
END //

DELIMITER ;

-- ============================================================================
-- STEP 6: Create helper function for course validation
-- ============================================================================

DELIMITER //

DROP FUNCTION IF EXISTS validateCourseDepartment //
CREATE FUNCTION validateCourseDepartment(p_course_id INT) 
RETURNS INT
DETERMINISTIC
BEGIN
    DECLARE v_department_id INT DEFAULT NULL;
    DECLARE v_accepts_courses BOOLEAN;
    
    SELECT c.department_id, d.accepts_courses 
    INTO v_department_id, v_accepts_courses
    FROM courses c
    JOIN departments d ON c.department_id = d.department_id
    WHERE c.id = p_course_id;
    
    IF v_department_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Course not found';
    END IF;
    
    IF v_accepts_courses = FALSE THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Course department does not accept course assignments';
    END IF;
    
    RETURN v_department_id;
END //

DELIMITER ;

-- ============================================================================
-- STEP 7: Create stored procedure to create student with department routing
-- ============================================================================

DELIMITER //

DROP PROCEDURE IF EXISTS spCreateStudentWithDepartment //
CREATE PROCEDURE spCreateStudentWithDepartment(
    IN p_studentNumber VARCHAR(255),
    IN p_email VARCHAR(255),
    IN p_surname VARCHAR(255),
    IN p_firstName VARCHAR(255),
    IN p_middleInitial VARCHAR(10),
    IN p_contactNo VARCHAR(255),
    IN p_educational_level VARCHAR(50),
    IN p_grade_level INT,
    IN p_course_id INT,
    OUT p_student_id INT,
    OUT p_department_id INT
)
BEGIN
    DECLARE v_department_id INT DEFAULT NULL;
    DECLARE v_error_msg VARCHAR(500);
    
    -- Determine department based on education level
    IF p_educational_level IN ('kinder', 'elementary', 'junior_high') THEN
        -- No course needed for K-10
        SET v_department_id = getDepartmentForStudent(p_educational_level, NULL);
    ELSE
        -- Require course for SHS+
        IF p_course_id IS NULL THEN
            SET v_error_msg = CONCAT('Course is required for ', p_educational_level, ' students');
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_error_msg;
        END IF;
        SET v_department_id = validateCourseDepartment(p_course_id);
    END IF;
    
    -- Insert student
    INSERT INTO students (studentNumber, email, surname, firstName, middleInitial, contactNo, educational_level, grade_level, department_id, course_id)
    VALUES (p_studentNumber, p_email, p_surname, p_firstName, p_middleInitial, p_contactNo, p_educational_level, p_grade_level, v_department_id, p_course_id);
    
    SET p_student_id = LAST_INSERT_ID();
    SET p_department_id = v_department_id;
END //

DELIMITER ;

-- ============================================================================
-- STEP 8: Create stored procedure to create course with validation
-- ============================================================================

DELIMITER //

DROP PROCEDURE IF EXISTS spCreateCourseWithValidation //
CREATE PROCEDURE spCreateCourseWithValidation(
    IN p_courseName VARCHAR(255),
    IN p_courseCode VARCHAR(50),
    IN p_educational_level VARCHAR(50),
    IN p_department_name VARCHAR(255),
    OUT p_course_id INT,
    OUT p_department_id INT
)
BEGIN
    DECLARE v_department_id INT DEFAULT NULL;
    DECLARE v_accepts_courses BOOLEAN;
    DECLARE v_error_msg VARCHAR(500);
    
    -- Find department
    SELECT department_id, accepts_courses INTO v_department_id, v_accepts_courses
    FROM departments 
    WHERE LOWER(department_name) = LOWER(p_department_name);
    
    -- Validate department exists
    IF v_department_id IS NULL THEN
        SET v_error_msg = CONCAT('Department "', p_department_name, '" not found');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_error_msg;
    END IF;
    
    -- Validate department accepts courses
    IF v_accepts_courses = FALSE THEN
        SET v_error_msg = CONCAT('Department "', p_department_name, '" does not accept course assignments');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_error_msg;
    END IF;
    
    -- Insert course
    INSERT INTO courses (courseName, courseCode, educational_level, department_id)
    VALUES (p_courseName, p_courseCode, p_educational_level, v_department_id);
    
    SET p_course_id = LAST_INSERT_ID();
    SET p_department_id = v_department_id;
END //

DELIMITER ;

-- ============================================================================
-- STEP 9: Create stored procedure to assign staff to departments
-- ============================================================================

DELIMITER //

DROP PROCEDURE IF EXISTS spAssignStaffToDepartments //
CREATE PROCEDURE spAssignStaffToDepartments(
    IN p_user_id INT,
    IN p_department_names JSON,
    IN p_assigned_by INT
)
BEGIN
    DECLARE v_department_id INT;
    DECLARE v_department_name VARCHAR(255);
    DECLARE v_index INT DEFAULT 0;
    DECLARE v_count INT;
    
    -- Get number of departments in JSON array
    SET v_count = JSON_LENGTH(p_department_names);
    
    -- Loop through departments
    WHILE v_index < v_count DO
        SET v_department_name = JSON_UNQUOTE(JSON_EXTRACT(p_department_names, CONCAT('$[', v_index, ']')));
        
        -- Find department
        SELECT department_id INTO v_department_id
        FROM departments 
        WHERE LOWER(department_name) = LOWER(v_department_name);
        
        IF v_department_id IS NOT NULL THEN
            -- Insert into junction table (ignore duplicates)
            INSERT IGNORE INTO user_departments (user_id, department_id, assignedBy)
            VALUES (p_user_id, v_department_id, p_assigned_by);
        END IF;
        
        SET v_index = v_index + 1;
    END WHILE;
END //

DELIMITER ;

-- ============================================================================
-- STEP 10: Create view for staff department assignments
-- ============================================================================

CREATE OR REPLACE VIEW v_staff_departments AS
SELECT 
    u.id AS user_id,
    u.email,
    u.firstName,
    u.lastName,
    u.role,
    GROUP_CONCAT(d.department_id ORDER BY d.department_id) AS department_ids,
    GROUP_CONCAT(d.department_name ORDER BY d.department_name SEPARATOR ', ') AS department_names,
    COUNT(d.department_id) AS department_count
FROM users u
LEFT JOIN user_departments ud ON u.id = ud.user_id
LEFT JOIN departments d ON ud.department_id = d.department_id
WHERE u.isActive = TRUE AND u.role = 'staff'
GROUP BY u.id;

-- ============================================================================
-- STEP 11: Create view for student department routing
-- ============================================================================

CREATE OR REPLACE VIEW v_student_routing AS
SELECT 
    s.id AS student_id,
    s.studentNumber,
    s.email,
    CONCAT(s.firstName, ' ', s.surname) AS fullName,
    s.educational_level,
    s.grade_level,
    c.courseName,
    d.department_id,
    d.department_name,
    d.department_type,
    CASE 
        WHEN s.educational_level IN ('kinder', 'elementary', 'junior_high') THEN 'No Course - Department Only'
        ELSE 'Course Assigned'
    END AS routing_type
FROM students s
LEFT JOIN courses c ON s.course_id = c.id
LEFT JOIN departments d ON s.department_id = d.department_id
WHERE s.isActive = TRUE;

-- ============================================================================
-- STEP 12: Create trigger to validate course department on insert
-- ============================================================================

DELIMITER //

DROP TRIGGER IF EXISTS trg_courses_before_insert //
CREATE TRIGGER trg_courses_before_insert
BEFORE INSERT ON courses
FOR EACH ROW
BEGIN
    -- Check department accepts courses
    IF NOT EXISTS (
        SELECT 1 FROM departments 
        WHERE department_id = NEW.department_id AND accepts_courses = TRUE
    ) THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Course must be assigned to a department that accepts courses';
    END IF;
END //

DELIMITER ;

-- ============================================================================
-- STEP 13: Create trigger to validate student department on insert
-- ============================================================================

DELIMITER //

DROP TRIGGER IF EXISTS trg_students_before_insert //
CREATE TRIGGER trg_students_before_insert
BEFORE INSERT ON students
FOR EACH ROW
BEGIN
    -- Validate education level and course combination
    IF NEW.educational_level IN ('senior_high', 'undergraduate', 'graduate', 'postgraduate') THEN
        -- Require course for these levels
        IF NEW.course_id IS NULL THEN
            SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Course is required for Senior High and College students';
        END IF;
        
        -- Validate course exists and has department
        IF NOT EXISTS (
            SELECT 1 FROM courses WHERE id = NEW.course_id AND department_id IS NOT NULL
        ) THEN
            SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Invalid course or course has no department assignment';
        END IF;
    END IF;
    
    -- Ensure department_id is set
    IF NEW.department_id IS NULL THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Student must have a valid department assignment';
    END IF;
END //

DELIMITER ;

-- ============================================================================
-- STEP 14: Create indexes for performance
-- ============================================================================

-- Additional indexes for courses
CREATE INDEX idx_courses_educational_level ON courses(educational_level);
CREATE INDEX idx_courses_department_active ON courses(department_id, isActive);

-- Additional indexes for students
CREATE INDEX idx_students_educational_level ON students(educational_level);
CREATE INDEX idx_students_grade_level ON students(grade_level);
CREATE INDEX idx_students_department_level ON students(department_id, educational_level);

-- Additional indexes for document_requests
CREATE INDEX idx_requests_department_status ON document_requests(department_id, statusId);
CREATE INDEX idx_requests_requester_type ON document_requests(requesterType, requesterId);

-- ============================================================================
-- STEP 15: Update existing data to meet new constraints
-- ============================================================================

-- Update existing students without educational_level
UPDATE students SET educational_level = 'undergraduate' WHERE educational_level IS NULL OR educational_level = '';

-- For students without department_id, assign based on their course
UPDATE students s
JOIN courses c ON s.course_id = c.id
SET s.department_id = c.department_id
WHERE s.department_id IS NULL AND s.course_id IS NOT NULL;

-- For students without course (K-10), assign department based on grade level
UPDATE students 
SET department_id = 4,  -- Basic Education
    educational_level = 'kinder'
WHERE educational_level IS NULL OR educational_level = ''
  AND (course_id IS NULL OR course_id = 0);

-- Update document_requests with department_id from course
UPDATE document_requests dr
JOIN courses c ON dr.courseId = c.id
SET dr.department_id = c.department_id
WHERE dr.department_id IS NULL;

-- ============================================================================
-- STEP 16: Make department_id NOT NULL with constraints
-- ============================================================================

-- This may fail if there are NULL values - we handled above
ALTER TABLE courses 
MODIFY COLUMN department_id INT NOT NULL,
ADD CONSTRAINT fk_courses_department FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE RESTRICT;

ALTER TABLE students 
MODIFY COLUMN department_id INT NOT NULL,
ADD CONSTRAINT fk_students_department FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE RESTRICT;

ALTER TABLE document_requests 
MODIFY COLUMN department_id INT NOT NULL,
ADD CONSTRAINT fk_requests_department FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE RESTRICT;

-- ============================================================================
-- COMMIT or ROLLBACK
-- ============================================================================

-- Check if any errors occurred
-- If successful, commit:
COMMIT;

-- If errors occurred, rollback:
-- ROLLBACK;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check department assignments
SELECT 'Departments with types:' AS info;
SELECT department_id, department_name, department_type, accepts_courses FROM departments ORDER BY department_id;

SELECT 'Courses without department:' AS info;
SELECT id, courseName, department_id FROM courses WHERE department_id IS NULL;

SELECT 'Students without department:' AS info;
SELECT id, studentNumber, educational_level, department_id, course_id FROM students WHERE department_id IS NULL;

SELECT 'Document requests without department:' AS info;
SELECT id, referenceNumber, department_id, courseId FROM document_requests WHERE department_id IS NULL;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Example 1: Assign staff to multiple departments
-- CALL spAssignStaffToDepartments(626, '["Graduate School", "Senior High School Department"]', 155);

-- Example 2: Create student with department routing (K-10)
-- CALL spCreateStudentWithDepartment('2024-001', 'student@spc.edu', 'Doe', 'John', 'A', '1234567', 'elementary', 3, NULL, @student_id, @dept_id);
-- Result: @dept_id = 5 (Grade School Department)

-- Example 3: Create student with course (SHS+)
-- CALL spCreateStudentWithDepartment('2024-002', 'student2@spc.edu', 'Smith', 'Jane', 'B', '1234568', 'senior_high', 11, 253, @student_id, @dept_id);
-- Result: @dept_id = 7 (Senior High School Department - from GAS course)

-- Example 4: Create course with validation
