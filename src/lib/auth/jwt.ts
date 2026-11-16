import { SignJWT, jwtVerify } from 'jose';
import { AuthSession } from './types';

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'attendx-enterprise-super-secure-jwt-secret-key-32chars'
);

export const AUTH_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'attendx_session_token';

export async function signToken(session: AuthSession, expiresIn: string = '8h'): Promise<string> {
  return await new SignJWT({ ...session })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(SECRET_KEY);
}

export async function verifyToken(token: string): Promise<AuthSession | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return {
      userId: String(payload.userId),
      email: String(payload.email),
      displayName: String(payload.displayName),
      role: payload.role as any,
      permissions: Array.isArray(payload.permissions) ? (payload.permissions as string[]) : [],
      employeeId: payload.employeeId ? String(payload.employeeId) : null,
    };
  } catch {
    return null;
  }
}
