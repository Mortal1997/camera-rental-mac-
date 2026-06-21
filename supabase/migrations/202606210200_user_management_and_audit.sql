-- Add approved_at column to approved_users for audit trail
ALTER TABLE approved_users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ DEFAULT NOW();

-- Add approved_by column to approved_users (admin who approved)
ALTER TABLE approved_users ADD COLUMN IF NOT EXISTS approved_by TEXT;

-- Create user activity log table for audit trail
CREATE TABLE IF NOT EXISTS user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'deleted')),
  operator_email TEXT NOT NULL,
  operator_role TEXT NOT NULL DEFAULT 'super_admin',
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: only super_admin can read logs
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin can read logs" ON user_activity_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.email = auth.jwt() ->> 'email'
        AND admin_users.role = 'super_admin'
    )
  );

CREATE POLICY "super_admin can insert logs" ON user_activity_log
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.email = operator_email
        AND admin_users.role = 'super_admin'
    )
  );
