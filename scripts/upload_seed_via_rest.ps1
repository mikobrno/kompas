$ServiceRoleKey = Read-Host "Enter SUPABASE_SERVICE_ROLE_KEY (from dashboard Settings -> API)"
if (-not $ServiceRoleKey) {
  Write-Output "Service role key is required to bypass RLS for seed"
  exit 1
}

$Url = "https://lobtcrdpwbfutdbmslsx.supabase.co"
$Headers = @{
  apikey = $ServiceRoleKey
  Authorization = "Bearer $ServiceRoleKey"
  "Content-Type" = "application/json"
  Prefer = "resolution=ignore-duplicates"
}

Write-Output "Uploading seed data to $Url..."

# Users
$users = @(
  @{ id='4d204e9d-403d-443f-b573-68947e18c47d'; email='kost@adminreal.cz'; full_name='Milan'; role='admin'; theme='light'; created_at='2025-10-23T16:09:11.895098Z' },
  @{ id='a25b40d4-feaf-4f97-8923-9f5a3b58d33b'; email='info@adminreal.cz'; full_name='Zuzana'; role='user'; theme='light'; created_at='2025-10-23T16:09:11.895098Z' },
  @{ id='7fe8c05d-3009-40e5-b90a-2ccf9802ac51'; email='dvorak@adminreal.cz'; full_name='David'; role='user'; theme='light'; created_at='2025-10-23T16:09:11.895098Z' },
  @{ id='8e17fa83-a314-4e60-89e9-681598a1ea39'; email='faktury@adminreal.cz'; full_name='Iveta'; role='user'; theme='light'; created_at='2025-10-23T16:09:11.895098Z' }
)

Write-Output "Inserting users..."
try {
  $usersJson = $users | ConvertTo-Json -Depth 3
  Invoke-RestMethod -Uri "$Url/rest/v1/users" -Method Post -Headers $Headers -Body $usersJson | Out-Null
  Write-Output "✓ Users inserted"
} catch {
  Write-Output "Users may already exist or error: $_"
}

Write-Output "`nFor full seed (categories, links, etc.), please use Supabase Studio SQL Editor:"
Write-Output "1. Open: https://supabase.com/dashboard/project/lobtcrdpwbfutdbmslsx/editor"
Write-Output "2. Copy content from: supabase/seed_cloud.sql"
Write-Output "3. Paste and run in SQL Editor"
Write-Output "`nAlternatively, install PostgreSQL client (psql) and run:"
Write-Output 'psql "postgresql://postgres.lobtcrdpwbfutdbmslsx:Osmicka63%40@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" -f supabase/seed_cloud.sql'
