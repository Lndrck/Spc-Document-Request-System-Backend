-- Create email verifications table for link-based email verification
CREATE TABLE IF NOT EXISTS email_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_token (token),
  INDEX idx_expires_at (expires_at)
);

-- Clean up expired tokens periodically (optional, can be done via cron job)
-- DELETE FROM email_verifications WHERE expires_at < NOW();