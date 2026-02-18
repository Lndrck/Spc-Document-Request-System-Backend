-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_published BOOLEAN DEFAULT TRUE,
    INDEX idx_created_at (created_at),
    INDEX idx_published (is_published)
);

-- Create transaction_days table
CREATE TABLE IF NOT EXISTS transaction_days (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    status ENUM('no transaction', 'limited', 'available') DEFAULT 'available',
    time_start TIME NULL,
    time_end TIME NULL,
    message TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_date (date),
    INDEX idx_status (status)
);

-- Insert sample data for announcements
INSERT INTO announcements (title, content) VALUES 
('Welcome to the New Semester!', 'We are excited to welcome all students for the new academic year. Document processing services are now available.'),
('Extended Processing Time During Finals', 'Please note that document processing may take longer during final examination periods. We appreciate your patience.'),
('Holiday Schedule Update', 'Our office will be closed on national holidays. Check back for specific dates and available services.');

-- Insert sample data for transaction days
INSERT INTO transaction_days (date, status, message) VALUES 
('2025-11-10', 'available', 'Normal transaction hours'),
('2025-11-15', 'no transaction', 'No transactions - system maintenance'),
('2025-11-20', 'limited', 'Limited hours: 8:00 AM - 12:00 PM only'),
('2025-11-25', 'available', 'Normal transaction hours resume');