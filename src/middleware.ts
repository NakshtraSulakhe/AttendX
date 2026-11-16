import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'attendx-enterprise-super-secure-jwt-secret-key-32chars'
);

const AUTH_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'attendx_session_token';

// Public path patterns that bypass auth check
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/biometric/events', // Protected by x-connector-secret in the API route handler
];

// File extension patterns that bypass auth check
const PUBLIC_ASSET_REGEX = /\.(png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2|ttf|eot)$/i;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Allow static assets and Next.js internal files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/_next') ||
    pathname === '/favicon.ico' ||
    PUBLIC_ASSET_REGEX.test(pathname)
  ) {
    return NextResponse.next();
  }

  // 2. Extract token from cookie or Authorization header
  const token =
    req.cookies.get(AUTH_COOKIE_NAME)?.value ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  let isAuthenticated = false;
  let decodedUser: any = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET_KEY);
      if (payload && payload.userId) {
        isAuthenticated = true;
        decodedUser = payload;
      }
    } catch {
      isAuthenticated = false;
    }
  }

  // 3. Handle /login page specifically
  if (pathname === '/login') {
    if (isAuthenticated) {
      // Already authenticated, redirect to main dashboard
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  // 4. Check if route is public
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + '/'));
  if (isPublic) {
    return NextResponse.next();
  }

  // 5. If not authenticated, block or redirect
  if (!isAuthenticated) {
    // If it's an API route, return 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Authentication token is missing or expired.' },
        { status: 401 }
      );
    }

    // Otherwise, redirect user to login page with return url
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 6. Request is authenticated: pass user context via headers
  const requestHeaders = new Headers(req.headers);
  if (decodedUser) {
    requestHeaders.set('x-user-id', String(decodedUser.userId));
    requestHeaders.set('x-user-email', String(decodedUser.email));
    requestHeaders.set('x-user-role', String(decodedUser.role));
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
