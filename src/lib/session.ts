/**
 * Edge-runtime compatible session token helpers.
 * Uses Web Crypto API (SubtleCrypto) with HMAC-SHA256.
 * Safe to import from both middleware (Edge) and Server Actions (Node.js).
 */

export const COOKIE_NAME = 'pos_session';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: COOKIE_MAX_AGE_SECONDS,
};

export interface SessionPermissions {
  isMaster: boolean;
  pages: string[];
  tagName: string;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'SESSION_SECRET environment variable is not set or too short. ' +
        'Set it to a random 32+ character string in your production environment.'
      );
    }
    // Dev-only fallback — warn clearly
    console.warn(
      '[UrbanPOS] WARNING: SESSION_SECRET is not set. Using insecure fallback.'
    );
    return 'urbanpos-dev-fallback-secret-change-me-now';
  }
  return secret;
}

export async function debugSessionSecret() {
  console.log("MiddleWare Secret Check:", getSecret().substring(0, 5) + "...");
}

async function getHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function base64urlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from({ length: binary.length }, (_, i) =>
    binary.charCodeAt(i)
  );
}

/**
 * Creates a signed session token string: base64url(payload).base64url(HMAC)
 */
export async function createSessionToken(
  permissions: SessionPermissions
): Promise<string> {
  const payload = base64urlEncode(
    new TextEncoder().encode(
      JSON.stringify({ ...permissions, iat: Date.now() })
    )
  );
  const key = await getHmacKey();
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload)
  );
  return `${payload}.${base64urlEncode(new Uint8Array(signature))}`;
}

/**
 * Verifies the token signature and returns the permissions payload.
 * Returns null if the token is invalid, tampered, or malformed.
 */
export async function verifySessionToken(
  token: string
): Promise<SessionPermissions | null> {
  try {
    const dotIndex = token.lastIndexOf('.');
    if (dotIndex === -1) return null;

    const payload = token.slice(0, dotIndex);
    const sig = token.slice(dotIndex + 1);

    const key = await getHmacKey();
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64urlDecode(sig),
      new TextEncoder().encode(payload)
    );

    if (!isValid) {
      console.error("[Session] Token signature invalid!");
      return null;
    }

    const data = JSON.parse(
      new TextDecoder().decode(base64urlDecode(payload))
    );

    if (typeof data.isMaster !== 'boolean' || !Array.isArray(data.pages)) {
      return null;
    }

    return {
      isMaster: data.isMaster,
      pages: data.pages,
      tagName: data.tagName || '',
    };
  } catch (err) {
    console.error("[Session] Verification threw an error:", err);
    return null;
  }
}
