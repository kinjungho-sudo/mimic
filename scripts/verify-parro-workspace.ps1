[CmdletBinding()]
param(
  [string]$ExpectedRootName = 'parro'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$rootName = Split-Path $repoRoot -Leaf

if ($rootName -ne $ExpectedRootName) {
  throw "Refusing to use legacy or unexpected workspace '$repoRoot'. Expected a root directory named '$ExpectedRootName'."
}

$gitRoot = (& git -C $repoRoot rev-parse --show-toplevel 2>$null).Trim()
if (-not $gitRoot) {
  throw "No Git repository found at '$repoRoot'."
}

$resolvedGitRoot = (Resolve-Path $gitRoot).Path
if ($resolvedGitRoot -ne $repoRoot) {
  throw "Git root mismatch. Expected '$repoRoot', found '$resolvedGitRoot'."
}

$manifestPath = Join-Path $repoRoot 'mimic_recorder\manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
  throw "Recorder manifest not found at '$manifestPath'."
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$branch = (& git -C $repoRoot branch --show-current).Trim()
$remote = (& git -C $repoRoot remote get-url origin).Trim()

[pscustomobject]@{
  ok = $true
  workspace = $repoRoot
  branch = $branch
  remote = $remote
  recorderPath = Split-Path $manifestPath -Parent
  recorderVersion = $manifest.version
} | ConvertTo-Json
