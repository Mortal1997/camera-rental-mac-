-- Add password_hash column to pending_users for storing user password before approval
ALTER TABLE pending_users ADD COLUMN IF NOT EXISTS password_hash TEXT;
