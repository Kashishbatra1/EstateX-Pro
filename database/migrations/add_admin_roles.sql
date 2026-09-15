-- =============================================================================
-- Add admin role support: super_admin | admin
-- Safe to run multiple times.
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE admin_role_enum AS ENUM ('super_admin', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS role admin_role_enum;

UPDATE admins
SET role = 'admin'
WHERE role IS NULL;

ALTER TABLE admins
  ALTER COLUMN role SET DEFAULT 'admin';

ALTER TABLE admins
  ALTER COLUMN role SET NOT NULL;
