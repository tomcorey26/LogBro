import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth';

const PROTECTED_ROUTES = ['/habits', '/routines', '/history', '/rankings', '/stats', '/timer', '/account'];
const AUTH_ROUTES = ['/login'];

// In-memory rate limiter for auth endpoints
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // max attempts per window
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 5 * 60 * 1000);

const RATE_LIMITED_ROUTES = ['/api/auth/login', '/api/auth/signup'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate limit auth endpoints
  if (RATE_LIMITED_ROUTES.includes(pathname)) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 },
      );
    }
  }

  const token = request.cookies.get('session')?.value;
  const session = token ? await verifySessionToken(token) : null;

  // Redirect unauthenticated users to /login
  if (PROTECTED_ROUTES.some(route => pathname.startsWith(route))) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Redirect authenticated users away from /login
  if (session && AUTH_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL('/routines', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/login', '/habits/:path*', '/routines/:path*', '/sessions/:path*', '/rankings/:path*', '/stats/:path*', '/timer/:path*', '/account/:path*', '/api/auth/:path*'],
};
