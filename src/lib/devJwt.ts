// Dev-only helper to mint a Supabase-compatible JWT signed with the local JWT secret
// Never use this in production. Requires VITE_SUPABASE_JWT_SECRET to be set locally.

function base64url(input: ArrayBuffer | string): string {
  let bytes: Uint8Array;
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input);
  } else {
    bytes = new Uint8Array(input);
  }
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  const b64 = btoa(str);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hmacSha256(key: string, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

export async function mintDevJwt(params: {
  jwtSecret: string;
  userId: string;
  email: string;
  role?: 'authenticated' | 'anon';
  expiresInSeconds?: number;
}): Promise<string> {
  const { jwtSecret, userId, email, role = 'authenticated', expiresInSeconds = 60 * 60 * 24 } = params;
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    aud: role,
    exp: now + expiresInSeconds,
    sub: userId,
    email,
    role,
    iss: 'supabase-demo',
  };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const sig = await hmacSha256(jwtSecret, data);
  const encodedSig = base64url(sig);
  return `${data}.${encodedSig}`;
}
