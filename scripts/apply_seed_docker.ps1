$seedDir = (Resolve-Path "./supabase").Path
$seedDir = $seedDir -replace '\\','/'

Write-Host "Mounting seed directory: $seedDir"

$env:PGPASSWORD = "Osmicka63@"

$connectionString = "postgresql://postgres.lobtcrdpwbfutdbmslsx@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require"

$dockerArgs = @(
  "run", "--rm",
  "-e", "PGPASSWORD=$env:PGPASSWORD",
  "-v", "${seedDir}:/seed",
  "postgres:15",
  "psql", $connectionString,
  "-f", "/seed/seed_cloud.sql"
)

Write-Host "Running: docker $($dockerArgs -join ' ')"

$process = Start-Process -FilePath "docker" -ArgumentList $dockerArgs -NoNewWindow -Wait -PassThru

if ($process.ExitCode -eq 0) {
  Write-Host "Seed applied successfully." -ForegroundColor Green
} else {
  Write-Host "Seed failed with exit code $($process.ExitCode)." -ForegroundColor Red
}
