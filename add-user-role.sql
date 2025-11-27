-- Add role column to users table
ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'uploader' CHECK (role IN ('admin', 'uploader'));

-- Update existing admin user to have admin role
UPDATE users SET role = 'admin' WHERE username = 'admin';
