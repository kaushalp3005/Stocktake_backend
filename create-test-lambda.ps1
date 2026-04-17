# Create minimal test Lambda package
Write-Host "Creating minimal test Lambda package..." -ForegroundColor Cyan

$BackendDir = $PSScriptRoot
$TestDir = Join-Path $BackendDir "lambda-test"
$ZipFile = Join-Path $BackendDir "lambda-test.zip"

# Clean and create test directory
if (Test-Path $TestDir) {
    Remove-Item -Path $TestDir -Recurse -Force
}
New-Item -ItemType Directory -Path $TestDir -Force | Out-Null

# Copy only the test lambda file
Copy-Item -Path (Join-Path $BackendDir "lambda-test.js") -Destination (Join-Path $TestDir "index.js") -Force

# Create minimal package.json
$testPackageJson = @{
    name = "lambda-test"
    version = "1.0.0" 
    main = "index.js"
} | ConvertTo-Json -Depth 10

Set-Content -Path (Join-Path $TestDir "package.json") -Value $testPackageJson -Force

# Create ZIP
if (Test-Path $ZipFile) {
    Remove-Item -Path $ZipFile -Force
}

Push-Location $TestDir
try {
    Compress-Archive -Path * -DestinationPath $ZipFile -Force
    
    $zipSize = (Get-Item $ZipFile).Length / 1KB
    Write-Host "Test package created: lambda-test.zip ($($zipSize.ToString('F1')) KB)" -ForegroundColor Green
    Write-Host "Upload this to test basic Lambda functionality" -ForegroundColor Yellow
    
} catch {
    Write-Host "Error creating ZIP: $_" -ForegroundColor Red
} finally {
    Pop-Location
}