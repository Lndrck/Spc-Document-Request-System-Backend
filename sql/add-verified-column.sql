-- Add verified column to email_verifications table
ALTER TABLE email_verifications
ADD COLUMN verified TINYINT(1) DEFAULT 0 AFTER expires_at;

-- Add index for verified column for faster queries
CREATE INDEX idx_verified ON email_verifications(verified);

-- Optional: Update existing records to mark them as verified if they don't have active tokens
-- This assumes that if there are no active tokens for an email, it was previously verified
-- UPDATE email_verifications
-- SET verified = 1
-- WHERE email NOT IN (
--     SELECT DISTINCT email FROM email_verifications
--     WHERE expires_at > NOW() AND verified = 0
-- );