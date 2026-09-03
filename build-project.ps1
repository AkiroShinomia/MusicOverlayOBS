$ErrorActionPreference = "Stop"

$projectRoot = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
$projectFile = Join-Path $projectRoot "MusicOverlay.csproj"
$publishRoot = Join-Path $projectRoot ".publish-output"
$publishedExe = Join-Path $publishRoot "MusicOverlay.exe"
$targetExe = Join-Path $projectRoot "MusicOverlay.exe"
$hashFile = Join-Path $projectRoot "MusicOverlay.exe.sha256"

if (-not (Test-Path -LiteralPath $projectFile)) {
    throw "MusicOverlay.csproj was not found in $projectRoot"
}

$resolvedPublishRoot = [IO.Path]::GetFullPath($publishRoot)
if (-not $resolvedPublishRoot.StartsWith(
    $projectRoot + [IO.Path]::DirectorySeparatorChar,
    [StringComparison]::OrdinalIgnoreCase
)) {
    throw "Publish directory escaped Project: $resolvedPublishRoot"
}

if (Test-Path -LiteralPath $resolvedPublishRoot) {
    Remove-Item -LiteralPath $resolvedPublishRoot -Recurse -Force
}

dotnet publish $projectFile `
    -c Release `
    -r win-x64 `
    --no-restore `
    --self-contained true `
    /p:PublishSingleFile=true `
    /p:IncludeNativeLibrariesForSelfExtract=true `
    /p:EnableCompressionInSingleFile=false `
    /p:DebugType=None `
    /p:DebugSymbols=false `
    -o $resolvedPublishRoot

if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish failed with exit code $LASTEXITCODE"
}

if (-not (Test-Path -LiteralPath $publishedExe)) {
    throw "Published MusicOverlay.exe was not created"
}

$publishedFile = Get-Item -LiteralPath $publishedExe
if ($publishedFile.Length -lt 150MB) {
    throw "The produced EXE is unexpectedly small: $($publishedFile.Length) bytes"
}

Copy-Item -LiteralPath $publishedExe -Destination $targetExe -Force
$hash = (Get-FileHash -LiteralPath $targetExe -Algorithm SHA256).Hash
Set-Content -LiteralPath $hashFile -Value "$hash  MusicOverlay.exe" -Encoding ascii

Remove-Item -LiteralPath $resolvedPublishRoot -Recurse -Force

$result = Get-Item -LiteralPath $targetExe
$version = [Diagnostics.FileVersionInfo]::GetVersionInfo($result.FullName)
Write-Host "Built: $($result.FullName)"
Write-Host "Version: $($version.FileVersion)"
Write-Host "Size: $([math]::Round($result.Length / 1MB, 2)) MB"
Write-Host "SHA256: $hash"
