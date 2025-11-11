#Requires -Version 5.1

param(
  [string]$ServiceRoleKey
)

$Url = "https://lobtcrdpwbfutdbmslsx.supabase.co/rest/v1"

if (-not $ServiceRoleKey) {
  $ServiceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY
}

if (-not $ServiceRoleKey) {
  $ServiceRoleKey = Read-Host -Prompt "Enter SUPABASE_SERVICE_ROLE_KEY"
}

if (-not $ServiceRoleKey) {
  Write-Error "Service role key is required to bypass RLS and inspect data."
  exit 1
}

$Headers = @{
  apikey = $ServiceRoleKey
  Authorization = "Bearer $ServiceRoleKey"
}

Write-Output "=== Checking users table ==="
try {
  $users = Invoke-RestMethod -Uri "$Url/users?select=id,email,role" -Headers $Headers
  Write-Output "Users count: $($users.Count)"
  $users | Format-Table
} catch {
  Write-Output "Error: $_"
}

Write-Output "`n=== Checking categories table ==="
try {
  $categories = Invoke-RestMethod -Uri "$Url/categories?select=id,name,owner_id" -Headers $Headers
  Write-Output "Categories count: $($categories.Count)"
  $categories | Format-Table
} catch {
  Write-Output "Error: $_"
}

Write-Output "`n=== Checking links table ==="
try {
  $links = Invoke-RestMethod -Uri "$Url/links?select=id,display_name,category_id" -Headers $Headers
  Write-Output "Links count: $($links.Count)"
  $links | Format-Table
} catch {
  Write-Output "Error: $_"
}
