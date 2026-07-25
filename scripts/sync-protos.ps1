Param()

$Root = Split-Path -Parent $PSScriptRoot
$ProtoSrc = Join-Path $Root 'protos'
if (-Not (Test-Path $ProtoSrc)) {
    Write-Error "No protos directory found at $ProtoSrc"
    exit 1
}

foreach ($svc in @('rust_analytics','backend')) {
    $dest = Join-Path $Root "$svc\protos"
    Write-Host "Syncing protos -> $dest"
    if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    Copy-Item -Path (Join-Path $ProtoSrc '*') -Destination $dest -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host 'Protos synced to service folders.'
