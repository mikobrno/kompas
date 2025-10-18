import process from 'node:process';
import crypto from 'node:crypto';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long';
// Defaults match seeded migration 20251018100000_seed_initial_users.sql
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'milan@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'milan123';

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in env');
  process.exit(1);
}

if (!SUPABASE_ANON) {
  console.error('Missing VITE_SUPABASE_ANON_KEY in env');
  process.exit(1);
}

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = { iss: 'supabase-demo', aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, ...payload };
  const encHeader = b64url(JSON.stringify(header));
  const encPayload = b64url(JSON.stringify(body));
  const data = `${encHeader}.${encPayload}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${data}.${signature}`;
}

async function rest(url, method = 'GET', token, body) {
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': SUPABASE_ANON,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${method} ${url} failed: ${res.status} ${res.statusText} - ${txt}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

async function ensurePublicUser(email, fullName, role = 'user') {
  // use service role to insert if missing
  if (!SUPABASE_SERVICE) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  const svcToken = SUPABASE_SERVICE;
  const list = await rest(`${SUPABASE_URL}/rest/v1/users?select=id,email,role&email=eq.${encodeURIComponent(email)}`, 'GET', svcToken);
  if (Array.isArray(list) && list.length > 0) return list[0].id;
  // generate uuid on server via RPC? simpler: let DB generate default if any, but our schema requires explicit id - generate in JS
  const uuid = crypto.randomUUID();
  const inserted = await rest(`${SUPABASE_URL}/rest/v1/users`, 'POST', svcToken, [{ id: uuid, email, full_name: fullName, role, theme: 'light' }]);
  return inserted[0].id;
}

async function getAdminIdentity() {
  // find Milan in public.users
  const svcToken = SUPABASE_SERVICE;
  if (!svcToken) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  const list = await rest(`${SUPABASE_URL}/rest/v1/users?select=id,email,role&email=eq.${encodeURIComponent(ADMIN_EMAIL)}`, 'GET', svcToken);
  if (!Array.isArray(list) || list.length === 0) {
    // create Milan as public user admin
    const id = await ensurePublicUser(ADMIN_EMAIL, 'Milan', 'admin');
    return { id };
  }
  // ensure role admin
  if (list[0].role !== 'admin') {
    await rest(`${SUPABASE_URL}/rest/v1/users?id=eq.${list[0].id}`, 'PATCH', svcToken, { role: 'admin' });
  }
  return { id: list[0].id };
}

async function main() {
  console.log('Preparing admin identity (JWT-based)…');
  const admin = await getAdminIdentity();
  const adminJwt = signJWT({ sub: admin.id }, SUPABASE_JWT_SECRET);

  console.log('Ensuring Zuzana exists...');
  const zuzanaId = await ensurePublicUser('zuzana@example.com', 'Zuzana', 'user');

  console.log('Creating category and link...');
  const catArr = await rest(`${SUPABASE_URL}/rest/v1/categories`, 'POST', adminJwt, [{ name: 'E2E Demo Kategorie', owner_id: admin.id, display_order: 0 }]);
  const cat = { id: catArr[0].id };
  const linkArr = await rest(`${SUPABASE_URL}/rest/v1/links`, 'POST', adminJwt, [{ category_id: cat.id, display_name: 'Predpisy | výpočet', url: 'https://example.com/predpisy', display_order: 0 }]);
  const link = { id: linkArr[0].id };

  console.log('Sharing link with Zuzana...');
  await rest(`${SUPABASE_URL}/rest/v1/link_shares`, 'POST', adminJwt, [{ link_id: link.id, shared_with_user_id: zuzanaId, permission_level: 'viewer' }]);

  console.log('Calling RPC as admin with impersonation...');
  const rows = await rest(`${SUPABASE_URL}/rest/v1/rpc/get_accessible_categories_with_permission`, 'POST', adminJwt, { override_user_id: zuzanaId });

  const catRow = rows.find(r => r.id === cat.id);
  if (!catRow) throw new Error('RPC did not return the category for Zuzana');
  if (!Array.isArray(catRow.shared_link_ids) || !catRow.shared_link_ids.includes(link.id)) {
    throw new Error('RPC returned category but shared_link_ids missing the shared link');
  }

  console.log('Querying links for that category (as admin, but visibility policies allow read)...');
  const zuzaLinks = await rest(`${SUPABASE_URL}/rest/v1/links?select=id,display_name&category_id=eq.${cat.id}&id=in.(${catRow.shared_link_ids.join(',')})`, 'GET', adminJwt);

  if (!zuzaLinks.some(l => l.id === link.id)) {
    throw new Error('Link not visible via select despite shared_link_ids');
  }

  console.log('SUCCESS: Zuzana can see the shared link via RPC and links select.');
}

main().catch((e) => {
  console.error('E2E failed:', e);
  process.exit(1);
});
