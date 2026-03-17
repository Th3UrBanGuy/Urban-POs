/**
 * Next.js Middleware — Server-enforced route protection.
 * Runs on ALL routes (except _next internals and static assets).
 *
 * Logic:
 *  - /login page: if a valid session cookie exists → redirect to /pos
 *                 if no valid cookie → show the login page (pass through)
 *  - Protected pages: if no valid cookie → redirect to /login
 *                     if valid cookie → pass through
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, COOKIE_NAME } from '@/lib/session';

const PROTECTED_PREFIXES = [
    '/pos',
    '/dashboard',
    '/sales',
    '/inventory',
    '/coupons',
    '/settings',
    '/unauthorized',
];

export async function middleware(request: NextRequest): Promise<NextResponse> {
    const { pathname } = request.nextUrl;

    // ── /login: redirect away if already authenticated ────────────────────────
    if (pathname === '/login' || pathname === '/setup') {
        const token = request.cookies.get(COOKIE_NAME)?.value;
        if (token) {
            const session = await verifySessionToken(token);
            if (session) {
                // Valid session — skip the login page and go straight in
                return NextResponse.redirect(new URL('/pos', request.url));
            }
        }
        // No valid session — let them see the login page
        return NextResponse.next();
    }

    // ── Protected pages: require a valid session ───────────────────────────────
    const isProtected = PROTECTED_PREFIXES.some((prefix) =>
        pathname.startsWith(prefix)
    );

    if (!isProtected) {
        return NextResponse.next();
    }

    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    const session = await verifySessionToken(token);
    if (!session) {
        // Tampered or expired cookie — clear it and send to login
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.delete(COOKIE_NAME);
        return response;
    }

    return NextResponse.next();
}

export const config = {
    /*
     * Run on everything EXCEPT:
     *   - Next.js internals (_next/*)
     *   - Static files (favicon, icons, manifest)
     *   - API routes
     */
    matcher: [
        '/((?!api|_next/static|_next/image|favicon\\.ico|icons|manifest\\.json).*)',
    ],
};
