-- Create departments table
CREATE TABLE departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- Add department_id to users table with foreign key
ALTER TABLE users ADD COLUMN department_id INT NULL, ADD FOREIGN KEY (department_id) REFERENCES departments(id);

-- Add department_id to students table
ALTER TABLE students ADD COLUMN department_id INT NULL;

-- Add department_id to alumni table
ALTER TABLE alumni ADD COLUMN department_id INT NULL;

-- Add department_id to document_requests table
ALTER TABLE document_requests ADD COLUMN department_id INT NULL;

-- Insert initial department data
INSERT INTO departments (name) VALUES
('Basic Education'),
('Grade School'),
('Junior High School'),
('Senior High School'),
('Higher Education Colleges'),
('College of Education'),
('College of Arts and Sciences'),
('College of Nursing'),
('College of Computer Studies'),
('College of Accountancy'),
('College of Business Management'),
('College of Physical Therapy'),
('College of Radiologic Technology'),
('College of Law'),
('Graduate School');