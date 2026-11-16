-- Seed 001: Initial Enterprise Roles, Permissions, Leave Types and Policies

-- ------------------------------------------------------------------------------
-- 1. SYSTEM ROLES
-- ------------------------------------------------------------------------------
INSERT INTO roles (name, code, description, is_system, created_at)
VALUES
  ('Super Administrator', 'SUPER_ADMIN', 'Full unrestricted enterprise authority', 1, NOW()),
  ('HR Administrator', 'HR_ADMIN', 'Personnel management, attendance policies, shifts & reports', 1, NOW()),
  ('Branch Administrator', 'BRANCH_ADMIN', 'Branch-level workforce and hardware oversight', 1, NOW()),
  ('Operations Manager', 'MANAGER', 'Departmental management, leave and overtime approvals', 1, NOW()),
  ('Team Leader', 'TEAM_LEADER', 'Roster oversight, live monitoring and break tracking', 1, NOW()),
  ('Employee', 'EMPLOYEE', 'Standard personnel self-service access', 1, NOW()),
  ('Compliance Auditor', 'AUDITOR', 'Read-only access to audit logs, logs and compliance reports', 1, NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description);

-- ------------------------------------------------------------------------------
-- 2. SYSTEM PERMISSIONS
-- ------------------------------------------------------------------------------
INSERT INTO permissions (action_key, category, description)
VALUES
  ('employee.view', 'Employee', 'View employee roster and profile data'),
  ('employee.create', 'Employee', 'Onboard new staff members'),
  ('employee.update', 'Employee', 'Modify employee profile, designation and department'),
  ('employee.delete', 'Employee', 'Deactivate or terminate employee record'),
  ('attendance.view', 'Attendance', 'View live attendance, daily sessions and punch history'),
  ('attendance.correct', 'Attendance', 'Submit manual punch correction requests'),
  ('attendance.approve', 'Attendance', 'Approve or reject attendance corrections'),
  ('attendance.export', 'Attendance', 'Export attendance and audit datasets'),
  ('shift.view', 'Shift', 'View shift schedules and configurations'),
  ('shift.create', 'Shift', 'Create and modify shift policies and grace windows'),
  ('shift.assign', 'Shift', 'Assign shifts to departments and individual staff'),
  ('leave.apply', 'Leave', 'Submit leave applications'),
  ('leave.approve', 'Leave', 'Approve or reject leave requests'),
  ('leave.manage', 'Leave', 'Configure leave types and annual credit quotas'),
  ('overtime.view', 'Overtime', 'Inspect overtime accrual records'),
  ('overtime.approve', 'Overtime', 'Approve or reject employee overtime hours'),
  ('reports.view', 'Reports', 'Access analytics dashboards and summary rollups'),
  ('reports.export', 'Reports', 'Generate and download CSV, Excel and PDF reports'),
  ('device.view', 'Device', 'View biometric terminal health, status and logs'),
  ('device.manage', 'Device', 'Register hardware terminals, trigger sync and edit credentials'),
  ('users.manage', 'Administration', 'Manage user accounts, passwords and account locks'),
  ('roles.manage', 'Administration', 'Configure RBAC permission sets and assign roles'),
  ('settings.manage', 'Administration', 'Modify system-wide policies, thresholds and webhooks')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- ------------------------------------------------------------------------------
-- 3. DEFAULT LEAVE TYPES
-- ------------------------------------------------------------------------------
INSERT INTO leave_types (name, code, annual_quota, is_paid, requires_approval, created_at)
VALUES
  ('Casual Leave', 'CL', 12, 1, 1, NOW()),
  ('Sick Leave', 'SL', 10, 1, 1, NOW()),
  ('Earned / Privilege Leave', 'EL', 15, 1, 1, NOW()),
  ('Leave Without Pay', 'LWP', 0, 0, 1, NOW()),
  ('Compensatory Off', 'COMP_OFF', 0, 1, 1, NOW())
ON DUPLICATE KEY UPDATE annual_quota = VALUES(annual_quota);

-- ------------------------------------------------------------------------------
-- 4. DEFAULT COMPANY & HQ BRANCH
-- ------------------------------------------------------------------------------
INSERT INTO companies (name, code, tax_id, timezone, currency, created_at, updated_at)
VALUES ('Taraj Global Solutions', 'TARAJ_GLOBAL', 'TAX-IN-2026-TARAJ', 'Asia/Kolkata', 'INR', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO branches (company_id, name, code, city, country, timezone, is_headquarters, created_at, updated_at)
SELECT id, 'Indore Headquarters', 'INDORE_HQ', 'Indore', 'India', 'Asia/Kolkata', 1, NOW(), NOW()
FROM companies WHERE code = 'TARAJ_GLOBAL'
ON DUPLICATE KEY UPDATE name = VALUES(name);
