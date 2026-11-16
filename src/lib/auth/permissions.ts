export const PERMISSIONS = {
  // Employee Management
  EMPLOYEE_VIEW: 'employee.view',
  EMPLOYEE_CREATE: 'employee.create',
  EMPLOYEE_UPDATE: 'employee.update',
  EMPLOYEE_DELETE: 'employee.delete',

  // Attendance Operations
  ATTENDANCE_VIEW: 'attendance.view',
  ATTENDANCE_CORRECT: 'attendance.correct',
  ATTENDANCE_APPROVE: 'attendance.approve',
  ATTENDANCE_EXPORT: 'attendance.export',

  // Shifts
  SHIFT_VIEW: 'shift.view',
  SHIFT_CREATE: 'shift.create',
  SHIFT_ASSIGN: 'shift.assign',

  // Leave Management
  LEAVE_APPLY: 'leave.apply',
  LEAVE_APPROVE: 'leave.approve',
  LEAVE_MANAGE: 'leave.manage',

  // Overtime
  OVERTIME_VIEW: 'overtime.view',
  OVERTIME_APPROVE: 'overtime.approve',

  // Reports
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',

  // Devices & Hardware
  DEVICE_VIEW: 'device.view',
  DEVICE_MANAGE: 'device.manage',

  // Administration
  USERS_MANAGE: 'users.manage',
  ROLES_MANAGE: 'roles.manage',
  SETTINGS_MANAGE: 'settings.manage',
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export function hasPermission(userPermissions: string[], requiredPermission: string): boolean {
  if (!userPermissions || !Array.isArray(userPermissions)) return false;
  return userPermissions.includes(requiredPermission);
}

export function hasAnyPermission(userPermissions: string[], requiredPermissions: string[]): boolean {
  if (!userPermissions || !Array.isArray(userPermissions)) return false;
  return requiredPermissions.some(perm => userPermissions.includes(perm));
}

export function hasAllPermissions(userPermissions: string[], requiredPermissions: string[]): boolean {
  if (!userPermissions || !Array.isArray(userPermissions)) return false;
  return requiredPermissions.every(perm => userPermissions.includes(perm));
}
