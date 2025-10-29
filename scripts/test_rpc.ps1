$Url = "https://lobtcrdpwbfutdbmslsx.supabase.co/rest/v1/rpc/get_accessible_categories_with_permission"
$ApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvYnRjcmRwd2JmdXRkYm1zbHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MDY5ODEsImV4cCI6MjA3NzA4Mjk4MX0.mRgYiy0tLo7SIPzgPe-HMx1o3X-hFWmt2nQ5r53Rg-A"
$Headers = @{
  apikey = $ApiKey
  Authorization = "Bearer $ApiKey"
  "Content-Type" = "application/json"
  Prefer = "params=single-object"
}
try {
  $Response = Invoke-RestMethod -Uri $Url -Method Get -Headers $Headers
  Write-Output "Status: Success"
  $Response | ConvertTo-Json -Depth 5
} catch {
  if ($_.Exception.Response) {
    $response = $_.Exception.Response
    if ($response) {
      Write-Output "Status code: $($response.StatusCode.value__)"
      Write-Output "Status description: $($response.StatusDescription)"
      $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
      $body = $reader.ReadToEnd()
      Write-Output "Response body: $body"
    } else {
      Write-Output $_
    }
  } else {
    Write-Output $_
  }
}
