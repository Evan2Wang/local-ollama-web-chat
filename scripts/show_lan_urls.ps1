$ips = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -notlike "127.*" -and
    $_.IPAddress -notlike "169.254.*" -and
    $_.PrefixOrigin -ne "WellKnown"
  } |
  Select-Object -ExpandProperty IPAddress

if (-not $ips) {
  Write-Host "LAN URL: no non-loopback IPv4 address found"
  exit 0
}

Write-Host ""
Write-Host "LAN access URLs:"
foreach ($ip in $ips) {
  Write-Host "  Frontend: http://$ip`:5173"
  Write-Host "  Backend:  http://$ip`:8000/api/health"
}
Write-Host ""
