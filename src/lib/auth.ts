/**
 * Server-only auth helpers — cookie set/get/clear.
 * Imports from 'next/headers' — do NOT import in middleware.
 * Import session.ts directly in middleware instead.
 */
import { cookies } from 'next/headers';
import {
    createSessionToken,
    verifySessionToken,
    COOKIE_NAME,
    COOKIE_OPTIONS,
    type SessionPermissions,
} from './session';

export type { SessionPermissions };

/** Sets the signed HTTP-only session cookie. */
export async function setAuthCookie(permissions: SessionPermissions): Promise<void> {
    const token = await createSessionToken(permissions);
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
        ...COOKIE_OPTIONS,
        // Force secure in production
        secure: process.env.NODE_ENV === 'production',
    });
}

/** Reads and verifies the session cookie. Returns null if missing or invalid. */
export async function getAuthSession(): Promise<SessionPermissions | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySessionToken(token);
}

/** Clears the session cookie (logout). */
export async function clearAuthCookie(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}
