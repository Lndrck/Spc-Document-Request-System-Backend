-- Alter email_verifications table to match task specification
-- Change 'token' column to 'code' VARCHAR(6)

ALTER TABLE email_verifications
CHANGE COLUMN token code VARCHAR(6) NOT NULL;

-- Update index name to match new column
ALTER TABLE email_verifications DROP INDEX idx_token;
CREATE INDEX idx_code ON email_verifications(code);