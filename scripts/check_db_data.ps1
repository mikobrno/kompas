$Url = "https://lobtcrdpwbfutdbmslsx.supabase.co/rest/v1"
$ApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvYnRjcmRwd2JmdXRkYm1zbHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MDY5ODEsImV4cCI6MjA3NzA4Mjk4MX0.mRgYiy0tLo7SIPzgPe-HMx1o3X-hFWmt2nQ5r53Rg-A"
$Headers = @{
  apikey = $ApiKey
  Authorization = "Bearer $ApiKey"
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
