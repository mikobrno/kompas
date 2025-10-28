// Admin-only password reset script using Supabase Admin API
// Usage (PowerShell):
//   $env:SUPABASE_URL="https://<project-ref>.supabase.co"; $env:SUPABASE_SERVICE_ROLE_KEY="<secret>"; node .\scripts\admin_set_password.mjs -e "kost@adminreal.cz" -p "NewPass123!"

import { createClient } from '@supabase/supabase-js'

function parseArgs(argv) {
  const res = { email: undefined, password: undefined }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if ((a === '-e' || a === '--email') && i + 1 < argv.length) {
      res.email = argv[++i]
    } else if ((a === '-p' || a === '--password') && i + 1 < argv.length) {
      res.password = argv[++i]
    } else if (a === '-h' || a === '--help') {
      console.log('Usage: node scripts/admin_set_password.mjs -e <email> -p <newPassword>')
      process.exit(0)
    }
  }
  return res
}

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.')
    process.exit(1)
  }

  const { email, password } = parseArgs(process.argv)
  if (!email || !password) {
    console.error('Missing required args. Run with -h for help.')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // Find user id from public.users (matches FK to auth.users)
  const { data: row, error: selErr } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (selErr) {
    console.error('Failed to query public.users:', selErr.message)
    process.exit(1)
  }
  if (!row?.id) {
    console.error('No public.users row for this email. Create the auth user first in Studio → Authentication → Users.')
    process.exit(2)
  }

  const userId = row.id
  const { data: updated, error: updErr } = await supabase.auth.admin.updateUserById(userId, { password })
  if (updErr) {
    console.error('Admin API updateUserById failed:', updErr.message)
    process.exit(3)
  }

  console.log(`Password updated for ${email} (user_id=${userId}).`)
}

main().catch((e) => {
  console.error('Unexpected error:', e)
  process.exit(99)
})
