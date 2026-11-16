-- Migration 003: Expand users table for enterprise auth and security

ALTER TABLE users 
  MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'EMPLOYEE',
  ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0 AFTER is_active,
  ADD COLUMN IF NOT EXISTS locked_until DATETIME(6) NULL AFTER failed_login_attempts,
  ADD COLUMN IF NOT EXISTS last_login_at DATETIME(6) NULL AFTER locked_until;
