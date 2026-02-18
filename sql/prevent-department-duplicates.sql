-- Simple and effective prevention of department duplicates

-- 1. Add a UNIQUE constraint to prevent duplicates at the database level
-- This is the most reliable and simple approach
ALTER TABLE departments ADD UNIQUE (name);

-- 2. Create an index on name for better performance (optional but recommended)
-- The UNIQUE constraint already creates an index, but this makes it explicit
CREATE INDEX idx_departments_name ON departments(name);

-- 3. Verify the constraint is working (optional test)
-- This query should fail with a duplicate key error:
-- INSERT INTO departments (name) VALUES ('College of Computer Studies');

-- 4. Additional foreign key constraints (if not already present)
-- These ensure referential integrity but are optional if already set up

-- For students table (if foreign key doesn't exist):
-- ALTER TABLE students ADD CONSTRAINT fk_students_department
-- FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;

-- For alumni table (if foreign key doesn't exist):
-- ALTER TABLE alumni ADD CONSTRAINT fk_alumni_department
-- FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;

-- For document_requests table (if foreign key doesn't exist):
-- ALTER TABLE document_requests ADD CONSTRAINT fk_requests_department
-- FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
