import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const anon = process.env.VITE_SUPABASE_ANON_KEY || '';
const email = process.env.TEST_EMAIL || 'milan@example.com';
const password = process.env.TEST_PASSWORD || 'milan123';

if (!anon) {
  console.error('Missing VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(url, anon);

try {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  console.log('error:', error);
  console.log('session:', data?.session ? 'OK' : null);
  if (error) process.exit(2);
  process.exit(0);
} catch (e) {
  console.error('Thrown:', e);
  process.exit(3);
}