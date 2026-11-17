$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

$environmentFiles = @(
    @{ Example = ".\client\.env.example"; Target = ".\client\.env" },
    @{ Example = ".\server\.env.example"; Target = ".\server\.env" }
)

foreach ($file in $environmentFiles) {
    if (-not (Test-Path -LiteralPath $file.Target)) {
        Copy-Item -LiteralPath $file.Example -Destination $file.Target
        Write-Host "Created $($file.Target). Update its placeholder values before starting the app."
    }
}

npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
Write-Host "Dependencies installed. Configure server\.env and start the frontend/backend in separate terminals."
