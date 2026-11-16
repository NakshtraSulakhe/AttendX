/**
 * Database Row Definitions for AttendX Enterprise
 * All IDs are typed as string to prevent 64-bit BigInt precision truncation.
 */

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

// ==========================================
// 1. Organization & Hierarchy
// ==========================================
export interface CompanyRow {
  id: string;
  name: string;
  code: string;
  tax_id: string | null;
  timezone: string;
  currency: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface BranchRow {
  id: string;
  company_id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  country: string;
  timezone: string;
  is_headquarters: number | boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface DepartmentRow {
  id: string;
  branch_id?: string | null;
  name: string;
  code: string;
  description: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface DesignationRow {
  id: string;
  title: string;
  code: string;
  level: number;
  description: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

// ==========================================
// 2. Employees & Personnel
// ==========================================
export type EmploymentStatus = 'ACTIVE' | 'ON_LEAVE' | 'PROBATION' | 'TERMINATED' | 'RESIGNED';

export interface EmployeeRow {
  id: string;
  employee_code: string;
  name: string;
  email: string | null;
  phone: string | null;
  department_id: string | null;
  designation_id?: string | null;
  designation?: string | null;
  reporting_manager_id?: string | null;
  biometric_number: string;
  status: EmploymentStatus;
  shift_id: string | null;
  date_of_joining: string; // YYYY-MM-DD
  profile_image: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface EmployeeDocumentRow {
  id: string;
  employee_id: string;
  document_type: string;
  title: string;
  file_path: string;
  file_size_bytes: number;
  mime_type: string;
  uploaded_at: Date | string;
}

// ==========================================
// 3. Authentication & RBAC
// ==========================================
export type UserRole = 'SUPER_ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE' | 'BRANCH_ADMIN' | 'TEAM_LEADER' | 'AUDITOR';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: string;
  employee_id: string | null;
  is_active: number | boolean;
  failed_login_attempts: number;
  locked_until: Date | string | null;
  last_login_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface RoleRow {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_system: number | boolean;
  created_at: Date | string;
}

export interface PermissionRow {
  id: string;
  action_key: string;
  category: string;
  description: string;
}

export interface UserSessionRow {
  id: string;
  user_id: string;
  ip_address: string;
  user_agent: string | null;
  expires_at: Date | string;
  created_at: Date | string;
}

export interface LoginHistoryRow {
  id: string;
  user_id: string | null;
  email_attempted: string;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  ip_address: string;
  user_agent: string | null;
  failure_reason: string | null;
  attempted_at: Date | string;
}

// ==========================================
// 4. Shifts & Schedules
// ==========================================
export interface ShiftConfigurationRow {
  id: string;
  name: string;
  code: string;
  is_overnight: number | boolean;
  shift_start_local: string; // e.g. "17:30:00"
  shift_end_local: string;   // e.g. "02:30:00"
  timezone: string;
  duration_minutes: number;
  grace_late_minutes: number;
  grace_early_exit_minutes: number;
  overtime_min_minutes: number;
  is_default: number | boolean;
  is_active: number | boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface ShiftAssignmentRow {
  id: string;
  employee_id: string;
  shift_id: string;
  effective_from: string;
  effective_to: string | null;
  is_active: number | boolean;
  assigned_by: string;
  created_at: Date | string;
}

// ==========================================
// 5. Biometric Devices & Hardware
// ==========================================
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'WARNING' | 'ERROR';

export interface BiometricDeviceRow {
  id: string;
  name: string;
  model: string;
  ip_address: string;
  port: number;
  use_https: number | boolean;
  timezone: string;
  sync_interval_seconds: number;
  connection_method: string;
  status: DeviceStatus;
  serial_number: string | null;
  firmware_version: string | null;
  last_connected_at: Date | string | null;
  last_sync_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface DeviceCredentialRow {
  id: string;
  device_id: string;
  username: string;
  encrypted_password: string;
  auth_type: string;
  updated_at: Date | string;
}

export interface DeviceSyncCheckpointRow {
  id: string;
  device_id: string;
  last_sync_time: string;
  last_serial_no: number;
  total_records_synced: number;
  sync_status: string;
  last_error: string | null;
  updated_at: Date | string;
}

// ==========================================
// 6. Raw Biometric Events & Attendance
// ==========================================
export interface BiometricRawEventRow {
  id: string;
  device_id: string | null;
  serial_no: number;
  event_time_utc: Date | string;
  event_time_device: string;
  employee_no_string: string;
  employee_id: string | null;
  card_no: string | null;
  verify_mode: string | null;
  major_code: number | null;
  minor_code: number | null;
  attendance_status: string | null;
  raw_payload: any;
  ingestion_source: string;
  is_processed: number | boolean;
  created_at: Date | string;
}

export type AttendanceStatus =
  | 'NOT_CHECKED_IN'
  | 'WORKING'
  | 'ON_BREAK'
  | 'COMPLETED'
  | 'LATE'
  | 'EARLY_EXIT'
  | 'HALF_DAY'
  | 'ABSENT'
  | 'ON_LEAVE'
  | 'MISSING_OUT'
  | 'FLAGGED';

export type SessionCompletionStatus = 'ACTIVE' | 'COMPLETED' | 'PENDING_CLOSURE' | 'AUTO_CLOSED';

export interface AttendanceSessionRow {
  id: string;
  employee_id: string;
  shift_id: string | null;
  business_date: string; // YYYY-MM-DD
  first_in_time: Date | string | null;
  last_in_time: Date | string | null;
  last_out_time: Date | string | null;
  current_interval_start: Date | string | null;
  in_count: number;
  out_count: number;
  completed_break_count: number;
  total_working_seconds: number;
  total_break_seconds: number;
  total_elapsed_seconds: number;
  total_work_minutes: number;
  late_minutes: number;
  early_exit_minutes: number;
  overtime_minutes: number;
  status: AttendanceStatus;
  completion_status: SessionCompletionStatus;
  is_inferred: number | boolean;
  is_overnight: number | boolean;
  is_manual_correction: number | boolean;
  notes: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface AttendanceIntervalRow {
  id: string;
  session_id: string;
  employee_id: string;
  interval_type: 'WORK' | 'BREAK' | 'UNKNOWN';
  start_time: Date | string;
  end_time: Date | string | null;
  duration_seconds: number;
  start_event_id: string | null;
  end_event_id: string | null;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface AttendanceCorrectionRow {
  id: string;
  session_id: string;
  employee_id: string;
  business_date: string;
  previous_in_time: Date | string | null;
  new_in_time: Date | string | null;
  previous_out_time: Date | string | null;
  new_out_time: Date | string | null;
  reason: string;
  requested_by: string;
  approved_by: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  admin_remarks: string | null;
  created_at: Date | string;
}

// ==========================================
// 7. Leave, Overtime & System Auditing
// ==========================================
export interface LeaveTypeRow {
  id: string;
  name: string;
  code: string;
  annual_quota: number;
  is_paid: number | boolean;
  requires_approval: number | boolean;
  created_at: Date | string;
}

export interface LeaveBalanceRow {
  id: string;
  employee_id: string;
  leave_type_id: string;
  year: number;
  total_credited: number;
  total_used: number;
  total_remaining: number;
}

export interface LeaveRequestRow {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  approver_id: string | null;
  approver_remarks: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface OvertimeRecordRow {
  id: string;
  employee_id: string;
  session_id: string;
  business_date: string;
  overtime_minutes: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approved_by: string | null;
  created_at: Date | string;
}

export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  ip_address: string | null;
  created_at: Date | string;
}
