export type SystemRole =
  | 'SUPER_ADMIN'
  | 'HR_ADMIN'
  | 'BRANCH_ADMIN'
  | 'MANAGER'
  | 'TEAM_LEADER'
  | 'EMPLOYEE'
  | 'AUDITOR';

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: SystemRole;
  employee_id: string | null;
  is_active: number | boolean;
  failed_login_attempts: number;
  locked_until: string | Date | null;
  last_login_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface SafeUser {
  id: string;
  email: string;
  displayName: string;
  role: SystemRole;
  employeeId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface AuthSession {
  userId: string;
  email: string;
  displayName: string;
  role: SystemRole;
  permissions: string[];
  employeeId: string | null;
}

export interface LoginResult {
  success: boolean;
  token?: string;
  user?: SafeUser;
  permissions?: string[];
  expiresAt?: string;
  error?: string;
  isLocked?: boolean;
}
