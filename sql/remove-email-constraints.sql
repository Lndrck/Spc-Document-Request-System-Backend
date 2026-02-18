-- Remove UNIQUE constraint on email column in students table
-- The constraint is named 'spcEmail' based on the database structure
ALTER TABLE students
DROP INDEX spcEmail;

-- Remove regular index on email column in alumni table (if needed)
-- ALTER TABLE alumni
-- DROP INDEX idx_email;
