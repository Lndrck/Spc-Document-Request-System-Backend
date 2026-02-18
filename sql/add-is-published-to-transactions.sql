-- Add is_published column to transaction_days table
ALTER TABLE transaction_days ADD COLUMN is_published BOOLEAN DEFAULT TRUE;

-- Update existing records to be published if status is not 'no transaction'
UPDATE transaction_days SET is_published = CASE
    WHEN status != 'no transaction' THEN TRUE
    ELSE FALSE
END;

-- Add index for performance
ALTER TABLE transaction_days ADD INDEX idx_is_published (is_published);