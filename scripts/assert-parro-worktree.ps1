param(
  [switch]$Deployment
)

$ErrorActionPreference = 'Stop'
$parroBaseline = '216c35fb6b0783524bc21f1600907524b5c06979'

git fetch origin dev
if ($LASTEXITCODE -ne 0) { throw 'git fetch origin dev failed.' }

git merge-base --is-ancestor $parroBaseline HEAD
if ($LASTEXITCODE -ne 0) {
  throw "STOP: HEAD does not contain the Parro baseline $parroBaseline."
}

if (-not $Deployment) {
  git merge-base --is-ancestor origin/dev HEAD
  if ($LASTEXITCODE -ne 0) {
    throw 'STOP: this branch is not based on the latest origin/dev.'
  }
}

if ($Deployment) {
  $projectFile = Join-Path (Get-Location) '.vercel/project.json'
  if (-not (Test-Path -LiteralPath $projectFile)) {
    throw 'STOP: .vercel/project.json is missing.'
  }
  $project = Get-Content -Raw -LiteralPath $projectFile | ConvertFrom-Json
  if ($project.projectName -ne 'parro-guide') {
    throw "STOP: linked Vercel project is '$($project.projectName)', expected 'parro-guide'."
  }
}

Write-Output 'Parro worktree guard passed.'
