-- Add role column to admin_users to distinguish super_admin from regular admin
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';

-- Only super_admin can see and use the approval management page
-- Update existing admins (if any) to be super_admin so they keep access
UPDATE admin_users SET role = 'super_admin' WHERE role IS NULL OR role = 'admin';

-- Ensure no duplicate emails
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_key ON admin_users(email);
