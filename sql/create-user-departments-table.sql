-- Migration: Create user_departments junction table for many-to-many relationship
-- Purpose: Allow staff users to be assigned to multiple departments
-- Date: 2026-02-02

CREATE TABLE IF NOT EXISTS user_departments (
    user_id INT NOT NULL,
    department_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, department_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_department_id (department_id)
);

-- Optional: Migrate existing single department_id assignments to the junction table
-- Uncomment if needed to backfill existing data:
-- INSERT INTO user_departments (user_id, department_id)
-- SELECT id, department_id FROM users WHERE department_id IS NOT NULL AND role = 'staff';
