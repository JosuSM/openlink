param(
    [string]$ServerUrl = "https://openlink-server.onrender.com/health",
    [string]$CiaToolsPath = "$env:TEMP\CIAToolsN-Win-x64.exe",
    [switch]$NoLaunch
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$nativeRoot = Join-Path $repoRoot "native\3ds"
$inputRoot = Join-Path $nativeRoot "cia\input"
$bash = "C:\devkitPro\msys2\usr\bin\bash.exe"

if (-not (Test-Path $bash)) {
    throw "devkitPro MSYS was not found at $bash"
}
if (-not (Test-Path $CiaToolsPath)) {
    throw "CIATools was not found at $CiaToolsPath"
}

$unixNativeRoot = $nativeRoot.Replace("\", "/").Replace("C:", "/c")
$makeCommand = "export DEVKITPRO=/c/devkitPro; export DEVKITARM=/c/devkitPro/devkitARM; cd '$unixNativeRoot'; make SERVER_URL='$ServerUrl'"
& $bash -lc $makeCommand
if ($LASTEXITCODE -ne 0) {
    throw "The native 3DS build failed with exit code $LASTEXITCODE"
}

New-Item -ItemType Directory -Force -Path $inputRoot | Out-Null
Get-ChildItem $inputRoot -File | Remove-Item -Force
Copy-Item (Join-Path $nativeRoot "openlink_3ds.elf") (Join-Path $inputRoot "OpenLink.elf")
Copy-Item (Join-Path $nativeRoot "openlink_3ds.3dsx") (Join-Path $inputRoot "OpenLink.3dsx")

$buildInfo = @{
    name = "OpenLink"
    version = "0.1.0"
    serverUrl = $ServerUrl
    builtAt = (Get-Date).ToUniversalTime().ToString("o")
} | ConvertTo-Json
Set-Content -Path (Join-Path $inputRoot "build-info.json") -Value $buildInfo -Encoding utf8

Write-Host "CIA input prepared at $inputRoot"
Write-Host "Import OpenLink.elf in CIATools and generate the RSF/ICN resources there."

if (-not $NoLaunch) {
    Start-Process -FilePath $CiaToolsPath -WorkingDirectory $inputRoot
}
