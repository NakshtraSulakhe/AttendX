import { NextRequest, NextResponse } from 'next/server';
import { AuthService, AUTH_COOKIE_NAME } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const ipAddress =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    const result = await AuthService.login(email, password, ipAddress, userAgent);

    if (!result.success || !result.token) {
      const status = result.isLocked ? 423 : 401; // 423 Locked or 401 Unauthorized
      return NextResponse.json(result, { status });
    }

    // Set secure HTTP-only session cookie
    const response = NextResponse.json({
      success: true,
      token: result.token,
      user: result.user,
      permissions: result.permissions,
      expiresAt: result.expiresAt,
    });

    const isProduction = process.env.NODE_ENV === 'production';
    const maxAgeSeconds = 8 * 60 * 60; // 8 hours

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: result.token,
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeSeconds,
    });

    return response;
  } catch (err: any) {
    console.error('[API /api/auth/login] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error during authentication' },
      { status: 500 }
    );
  }
}
