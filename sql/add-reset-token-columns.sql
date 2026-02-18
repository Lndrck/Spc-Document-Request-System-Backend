-- Add reset token columns to users table for forgot password functionality
USE document_request_db;

-- Add reset_token and reset_token_expiry columns to users table
ALTER TABLE users
ADD COLUMN reset_token VARCHAR(255) NULL,
ADD COLUMN reset_token_expiry DATETIME NULL;

-- Create index on reset_token for faster lookups
CREATE INDEX idx_reset_token ON users(reset_token);

-- Show the updated table structure
DESCRIBE users;
