import { NextRequest, NextResponse } from 'next/server';
import { AuthService, verifyToken, AUTH_COOKIE_NAME } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token =
      req.cookies.get(AUTH_COOKIE_NAME)?.value ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const session = await verifyToken(token);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Invalid or expired session' }, { status: 401 });
    }

    const user = await AuthService.getUserById(session.userId);
    if (!user || !user.isActive) {
      return NextResponse.json({ success: false, error: 'User account inactive or removed' }, { status: 401 });
    }

    const permissions = await AuthService.getUserPermissions(user.id);

    return NextResponse.json({
      success: true,
      user,
      permissions,
    });
  } catch (err: any) {
    console.error('[API /api/auth/me] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
