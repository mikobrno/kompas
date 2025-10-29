param(
  [Parameter(Mandatory=$false)][string]$DatabaseUrl,
  [Parameter(Mandatory=$false)][string]$ProjectRef
)

$ErrorActionPreference = 'Stop'

function Write-Info($msg) { Write-Host "[info] $msg" -ForegroundColor Cyan }
function Write-Err($msg) { Write-Host "[error] $msg" -ForegroundColor Red }

# Validate input
if (-not $DatabaseUrl -and -not $ProjectRef) {
  Write-Err "Použijte buď -DatabaseUrl <POSTGRES_URL> nebo -ProjectRef <SUPABASE_REF>."
  Write-Err "- Pro DATABASE_URL: postgresql://USER:PASSWORD@HOST:PORT/DB?sslmode=require (pozor na URL-encoding @ -> %40)"
  Write-Err "- Pro ProjectRef: vyžaduje SUPABASE_ACCESS_TOKEN v env proměnné"
  exit 1
}

$repo = (Get-Location).Path

# Always pull latest CLI image to avoid version drift
$image = "supabase/cli:latest"
try {
  Write-Info "Zkouším stáhnout $image ..."
  docker pull $image | Out-Null
} catch {
  Write-Info "Docker Hub pull selhal, zkouším ghcr.io/supabase/cli:latest ..."
  $image = "ghcr.io/supabase/cli:latest"
  try {
    docker pull $image | Out-Null
  } catch {
    Write-Err "Nepodařilo se stáhnout supabase CLI image ani z Docker Hub ani z GHCR. Přihlaste se (docker login) nebo zkuste lokální 'supabase' binárku."
    exit 1
  }
}

if ($DatabaseUrl) {
  Write-Info "Spouštím db push proti zadanému DATABASE_URL (bezpečně v kontejneru)..."
  $volume = "$($repo):/work"
  docker run --rm -v $volume -w /work -e DATABASE_URL=$DatabaseUrl $image db push --db-url $DatabaseUrl
  exit $LASTEXITCODE
}

if ($ProjectRef) {
  if (-not $env:SUPABASE_ACCESS_TOKEN) {
    Write-Err "Chybí SUPABASE_ACCESS_TOKEN v prostředí pro link na projekt."
    exit 1
  }
  Write-Info "Spouštím db push proti Supabase projektu ($ProjectRef) s PAT z env..."
  $volume = "$($repo):/work"
  docker run --rm -v $volume -w /work -e SUPABASE_ACCESS_TOKEN -e SUPABASE_PROJECT_REF=$ProjectRef $image db push
  exit $LASTEXITCODE
}
