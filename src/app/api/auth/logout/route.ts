import { NextRequest, NextResponse } from 'next/server';
import { AuthService, verifyToken, AUTH_COOKIE_NAME } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const token =
      req.cookies.get(AUTH_COOKIE_NAME)?.value ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (token) {
      const session = await verifyToken(token);
      if (session) {
        await AuthService.logout(session.userId);
      }
    }

    const response = NextResponse.json({ success: true, message: 'Successfully logged out' });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (err: any) {
    console.error('[API /api/auth/logout] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error during logout' },
      { status: 500 }
    );
  }
}
