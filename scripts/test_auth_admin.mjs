import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

try {
  const { data, error } = await supabase.auth.admin.listUsers();
  console.log('listUsers error:', error);
  console.log('users count:', data?.users?.length);
  process.exit(error ? 2 : 0);
} catch (e) {
  console.error('Thrown:', e);
  process.exit(3);
}