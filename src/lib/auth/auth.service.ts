import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query, queryOne, execute, withTransaction } from '../database';
import { UserRecord, SafeUser, AuthSession, LoginResult } from './types';
import { signToken } from './jwt';

export class AuthService {
  /**
   * Fetch all effective permissions for a user across their assigned role(s)
   */
  static async getUserPermissions(userId: string | number): Promise<string[]> {
    const rows = await query<{ action_key: string }>(
      `SELECT DISTINCT p.action_key
       FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       JOIN roles r ON rp.role_id = r.id
       WHERE r.code IN (
         SELECT u.role FROM users u WHERE u.id = ?
         UNION
         SELECT r2.code FROM user_roles ur JOIN roles r2 ON ur.role_id = r2.id WHERE ur.user_id = ?
       )`,
      [userId, userId]
    );

    return rows.map((r) => r.action_key);
  }

  /**
   * Authenticate a user with email and password, enforcing account locking and audit logging
   */
  static async login(
    emailInput: string,
    passwordInput: string,
    ipAddress: string = '127.0.0.1',
    userAgent: string = 'Unknown'
  ): Promise<LoginResult> {
    const email = emailInput.trim().toLowerCase();

    // 1. Fetch user record
    const user = await queryOne<UserRecord>(
      'SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [email]
    );

    if (!user) {
      await this.recordLoginAttempt(null, email, 'FAILED', ipAddress, userAgent, 'User not found');
      return { success: false, error: 'Invalid email or password' };
    }

    const now = new Date();

    // 2. Check if account is temporarily locked
    if (user.locked_until && new Date(user.locked_until) > now) {
      const remainingMs = new Date(user.locked_until).getTime() - now.getTime();
      const remainingMins = Math.ceil(remainingMs / (60 * 1000));
      await this.recordLoginAttempt(
        user.id,
        email,
        'BLOCKED',
        ipAddress,
        userAgent,
        `Account locked for ${remainingMins} more minute(s)`
      );
      return {
        success: false,
        isLocked: true,
        error: `Account is temporarily locked due to multiple failed attempts. Please retry in ${remainingMins} minute(s).`,
      };
    }

    // 3. Check if account is deactivated
    if (!user.is_active) {
      await this.recordLoginAttempt(user.id, email, 'BLOCKED', ipAddress, userAgent, 'Account inactive');
      return { success: false, error: 'Your account is deactivated. Please contact your system administrator.' };
    }

    // 4. Validate password
    const isPasswordValid = await bcrypt.compare(passwordInput, user.password_hash);

    if (!isPasswordValid) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      const MAX_ATTEMPTS = 5;

      if (attempts >= MAX_ATTEMPTS) {
        // Lock account for 15 minutes
        await execute(
          `UPDATE users 
           SET failed_login_attempts = ?, locked_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE), updated_at = NOW() 
           WHERE id = ?`,
          [attempts, user.id]
        );
        await this.recordLoginAttempt(
          user.id,
          email,
          'BLOCKED',
          ipAddress,
          userAgent,
          `Exceeded maximum failed attempts (${attempts}/${MAX_ATTEMPTS}). Locked for 15 minutes.`
        );
        return {
          success: false,
          isLocked: true,
          error: 'Too many failed login attempts. Your account has been locked for 15 minutes.',
        };
      } else {
        await execute(
          'UPDATE users SET failed_login_attempts = ?, updated_at = NOW() WHERE id = ?',
          [attempts, user.id]
        );
        await this.recordLoginAttempt(
          user.id,
          email,
          'FAILED',
          ipAddress,
          userAgent,
          `Incorrect password (attempt ${attempts}/${MAX_ATTEMPTS})`
        );
        return {
          success: false,
          error: `Invalid email or password. Attempt ${attempts} of ${MAX_ATTEMPTS}.`,
        };
      }
    }

    // 5. Successful authentication: Reset failed attempts and update last login
    await execute(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW(), updated_at = NOW() WHERE id = ?',
      [user.id]
    );

    // 6. Fetch permissions
    const permissions = await this.getUserPermissions(user.id);

    // 7. Prepare session payload
    const sessionPayload: AuthSession = {
      userId: String(user.id),
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      permissions,
      employeeId: user.employee_id ? String(user.employee_id) : null,
    };

    // 8. Sign JWT (valid for 8 hours)
    const token = await signToken(sessionPayload, '8h');
    const sessionId = crypto.randomUUID();

    // 9. Persist user session in database
    await execute(
      `INSERT INTO user_sessions (id, user_id, ip_address, user_agent, expires_at, created_at)
       VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 8 HOUR), NOW())`,
      [sessionId, user.id, ipAddress.slice(0, 45), userAgent.slice(0, 500)]
    );

    // 10. Record login history
    await this.recordLoginAttempt(user.id, email, 'SUCCESS', ipAddress, userAgent, null);

    const safeUser: SafeUser = {
      id: String(user.id),
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      employeeId: user.employee_id ? String(user.employee_id) : null,
      isActive: Boolean(user.is_active),
      lastLoginAt: user.last_login_at ? new Date(user.last_login_at).toISOString() : null,
    };

    return {
      success: true,
      token,
      user: safeUser,
      permissions,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    };
  }

  /**
   * Log out user session
   */
  static async logout(userId: string | number): Promise<void> {
    await execute('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
  }

  /**
   * Get safe user details by ID
   */
  static async getUserById(userId: string | number): Promise<SafeUser | null> {
    const user = await queryOne<UserRecord>(
      'SELECT id, email, display_name, role, employee_id, is_active, last_login_at FROM users WHERE id = ?',
      [userId]
    );

    if (!user) return null;

    return {
      id: String(user.id),
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      employeeId: user.employee_id ? String(user.employee_id) : null,
      isActive: Boolean(user.is_active),
      lastLoginAt: user.last_login_at ? new Date(user.last_login_at).toISOString() : null,
    };
  }

  /**
   * Record login event into immutable login_history
   */
  private static async recordLoginAttempt(
    userId: string | number | null,
    emailAttempted: string,
    status: 'SUCCESS' | 'FAILED' | 'BLOCKED',
    ipAddress: string,
    userAgent: string,
    failureReason: string | null
  ): Promise<void> {
    try {
      await execute(
        `INSERT INTO login_history (user_id, email_attempted, status, ip_address, user_agent, failure_reason, attempted_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          userId ? String(userId) : null,
          emailAttempted.slice(0, 191),
          status,
          ipAddress.slice(0, 45),
          userAgent.slice(0, 500),
          failureReason ? failureReason.slice(0, 150) : null,
        ]
      );
    } catch (err) {
      console.error('[AuthService] Failed to record login attempt:', err);
    }
  }
}
