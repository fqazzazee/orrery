# SPDX-License-Identifier: GPL-2.0-or-later
# Builds Orrery for Windows into dist/windows/:
#   Orrery-VERSION-win-x64/            the app folder: Orrery.exe, Orrery.scr, app/, the .NET runtime
#   Orrery-VERSION-win-x64.zip         that folder, to unzip anywhere
#   Orrery-VERSION-win-x64-setup.exe   the installer, if Inno Setup 6 is found
#   (the same three for arm64)
#   Orrery-VERSION-lively.zip          the page alone, for Lively Wallpaper
#   SHA256SUMS-windows
#
# Usage: windows/build.ps1 [-Arch x64,arm64] [-NoInstaller] [-Step all|publish|package|sums]
# The steps let a release sign Orrery.exe and Orrery.scr after publish, and
# the installers after package, before the checksums.
# Inno Setup's ISCC.exe is looked for in $env:ISCC, on the PATH, and in its
# usual install folders.

param(
    [string[]]$Arch = @('x64', 'arm64'),
    [switch]$NoInstaller,
    [ValidateSet('all', 'publish', 'package', 'sums')]
    [string]$Step = 'all'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.IO.Compression.FileSystem
$Arch = $Arch -split ',' | Where-Object { $_ }     # "x64,arm64" from pwsh -File too

$Root = Split-Path -Parent $PSScriptRoot
$Dist = Join-Path $Root 'dist/windows'
$Version = (Get-Content (Join-Path $Root 'metadata.json') -Raw | ConvertFrom-Json).'version-name'
New-Item -ItemType Directory -Force $Dist | Out-Null

function Zip($Folder, $ZipPath, [bool]$WithFolder) {
    Remove-Item $ZipPath -Force -ErrorAction SilentlyContinue
    [IO.Compression.ZipFile]::CreateFromDirectory($Folder, $ZipPath, [IO.Compression.CompressionLevel]::Optimal, $WithFolder)
}

function Find-Iscc {
    if ($env:ISCC -and (Test-Path $env:ISCC)) { return $env:ISCC }
    $onPath = Get-Command ISCC.exe -ErrorAction SilentlyContinue
    if ($onPath) { return $onPath.Source }
    foreach ($dir in @(${env:ProgramFiles(x86)}, $env:ProgramFiles, (Join-Path $env:LOCALAPPDATA 'Programs'))) {
        if ($dir -and (Test-Path (Join-Path $dir 'Inno Setup 6/ISCC.exe'))) { return Join-Path $dir 'Inno Setup 6/ISCC.exe' }
    }
    return $null
}

$publish = $Step -in 'all', 'publish'
$package = $Step -in 'all', 'package'
$iscc = if ($NoInstaller -or -not $package) { $null } else { Find-Iscc }
if ($package -and -not $NoInstaller -and -not $iscc) { Write-Warning 'Inno Setup 6 not found: no installer. Set $env:ISCC to ISCC.exe to build one.' }

# Self-contained, not single-file: Orrery.exe and Orrery.scr are both small
# apphosts next to the runtime and app/, and need no .NET installed.
function Publish($a, $out) {
    Write-Host "== $(Split-Path -Leaf $out)"
    if (Test-Path $out) { Remove-Item $out -Recurse -Force }
    dotnet publish (Join-Path $Root 'windows/Orrery') -c Release -r "win-$a" --self-contained true `
        -p:PublishSingleFile=false -p:Version=$Version -p:DebugType=None -p:DebugSymbols=false `
        -p:AllowedReferenceRelatedFileExtensions=none -o $out --nologo
    if ($LASTEXITCODE) { throw "dotnet publish failed for $a" }
    # The screensaver is the same apphost renamed. The project copies it;
    # this makes sure the publish folder has it too.
    $scr = Join-Path $out 'Orrery.scr'
    if (-not (Test-Path $scr)) { Copy-Item (Join-Path $out 'Orrery.exe') $scr }
}

# The zip and the installer, from the published folder.
function Package($a, $out) {
    $name = Split-Path -Leaf $out
    if (-not (Test-Path (Join-Path $out 'Orrery.exe'))) { throw "$out is missing: run -Step publish first" }
    Write-Host "== $name.zip"
    Zip $out (Join-Path $Dist "$name.zip") $true
    if ($iscc) {
        Write-Host "== $name-setup.exe"
        & $iscc /Q "/DAppVersion=$Version" "/DArch=$a" "/DSourceDir=$out" "/O$Dist" (Join-Path $PSScriptRoot 'installer/orrery.iss')
        if ($LASTEXITCODE) { throw "Inno Setup failed for $a" }
    }
}

# Lively Wallpaper: web/, the lib/ modules the page imports (the same list
# the project copies) and Lively's own two files.
function Lively {
    Write-Host "== Orrery-$Version-lively.zip"
    $stage = Join-Path $Dist 'lively'
    if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
    New-Item -ItemType Directory -Force (Join-Path $stage 'lib') | Out-Null
    Copy-Item (Join-Path $PSScriptRoot 'web') (Join-Path $stage 'web') -Recurse
    $project = Get-Content (Join-Path $PSScriptRoot 'Orrery/Orrery.csproj') -Raw
    $libs = [regex]::Matches($project, '\.\.\\\.\.\\lib\\([\w-]+\.js)') | ForEach-Object { $_.Groups[1].Value }
    if (-not $libs) { throw 'no lib/ modules found in Orrery.csproj' }
    foreach ($lib in $libs) { Copy-Item (Join-Path $Root "lib/$lib") (Join-Path $stage 'lib') }
    Copy-Item (Join-Path $PSScriptRoot 'lively/*') $stage
    Zip $stage (Join-Path $Dist "Orrery-$Version-lively.zip") $false
    Remove-Item $stage -Recurse -Force
}

# Checksums of what gets uploaded, as sha256sum writes them.
function Sums {
    Push-Location $Dist
    try {
        Get-ChildItem -File -Include *.zip, *.exe -Path * | Sort-Object Name | ForEach-Object {
            "$((Get-FileHash $_.Name -Algorithm SHA256).Hash.ToLower())  $($_.Name)"
        } | Set-Content -Encoding ascii 'SHA256SUMS-windows'
    } finally {
        Pop-Location
    }
}

foreach ($a in $Arch) {
    $out = Join-Path $Dist "Orrery-$Version-win-$a"
    if ($publish) { Publish $a $out }
    if ($package) { Package $a $out }
}
if ($package) { Lively }
if ($Step -in 'all', 'sums') { Sums }

Get-ChildItem $Dist -File | Format-Table Name, @{n = 'MB'; e = { [math]::Round($_.Length / 1MB, 1) } } -AutoSize
