# Create Lambda Package without dependencies (for use with Lambda Layer)
# Simple script to package just the code files

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  StockTake Lambda Code Package" -ForegroundColor Cyan  
Write-Host "  (No dependencies - uses Lambda Layer)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$BackendDir = $PSScriptRoot
$LambdaCodeDir = Join-Path $BackendDir "lambda-code-only"
$ZipFile = Join-Path $BackendDir "stocktake-lambda-code.zip"

# Create lambda-code-only directory
if (Test-Path $LambdaCodeDir) {
    Remove-Item -Path $LambdaCodeDir -Recurse -Force
}
New-Item -ItemType Directory -Path $LambdaCodeDir -Force | Out-Null
Write-Host "Created lambda-code-only directory" -ForegroundColor Green

# Copy main files
$MainFiles = @(
    "index.ts",
    "lambda.js"
)

Write-Host ""
Write-Host "Copying main files..." -ForegroundColor Yellow
foreach ($file in $MainFiles) {
    $sourcePath = Join-Path $BackendDir $file
    $destPath = Join-Path $LambdaCodeDir $file
    if (Test-Path $sourcePath) {
        Copy-Item -Path $sourcePath -Destination $destPath -Force
        Write-Host "  Copied: $file" -ForegroundColor Green
    } else {
        Write-Host "  Missing: $file" -ForegroundColor Red
    }
}

# Copy directories (excluding node_modules)
$Directories = @(
    "routes",
    "middleware", 
    "services",
    "utils",
    "shared",
    "prisma"
)

Write-Host ""
Write-Host "Copying source directories..." -ForegroundColor Yellow
foreach ($dir in $Directories) {
    $sourcePath = Join-Path $BackendDir $dir
    $destPath = Join-Path $LambdaCodeDir $dir
    
    if (Test-Path $sourcePath) {
        Copy-Item -Path $sourcePath -Destination $destPath -Recurse -Force
        $fileCount = (Get-ChildItem -Path $destPath -Recurse -File).Count
        Write-Host "  Copied: $dir ($fileCount files)" -ForegroundColor Green
    } else {
        Write-Host "  Missing: $dir" -ForegroundColor Gray
    }
}

# Create minimal package.json (just for Lambda, dependencies are in layer)
$packageJson = @{
    name = "stocktake-lambda"
    version = "1.0.0"
    description = "StockTake Lambda Function Code"
    main = "lambda.js"
    type = "commonjs"
} | ConvertTo-Json -Depth 10

$packageJsonPath = Join-Path $LambdaCodeDir "package.json"
Set-Content -Path $packageJsonPath -Value $packageJson -Force
Write-Host "  Created minimal package.json" -ForegroundColor Green

# Create ZIP file
Write-Host ""
Write-Host "Creating ZIP file..." -ForegroundColor Yellow

if (Test-Path $ZipFile) {
    Remove-Item -Path $ZipFile -Force
}

Push-Location $LambdaCodeDir
try {
    Compress-Archive -Path * -DestinationPath $ZipFile -Force
    
    $zipSize = (Get-Item $ZipFile).Length / 1KB
    $zipSizeFormatted = "{0:N1}" -f $zipSize
    
    Write-Host "  ZIP created successfully" -ForegroundColor Green
    Write-Host ""
    Write-Host "Package Details:" -ForegroundColor Cyan
    Write-Host "  File: stocktake-lambda-code.zip" -ForegroundColor White
    Write-Host "  Size: $zipSizeFormatted KB" -ForegroundColor White
    Write-Host "  Location: $ZipFile" -ForegroundColor Gray
    
} catch {
    Write-Host "  Error creating ZIP: $_" -ForegroundColor Red
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "Deployment Instructions:" -ForegroundColor Yellow
Write-Host "  1. Upload stocktake-lambda-code.zip to your Lambda function" -ForegroundColor White
Write-Host "  2. Make sure your Lambda Layer with dependencies is attached" -ForegroundColor White
Write-Host "  3. Set Handler to: lambda.handler" -ForegroundColor White
Write-Host "  4. Configure environment variables" -ForegroundColor White
Write-Host "  5. Set timeout to 30+ seconds and memory to 1024+ MB" -ForegroundColor White
Write-Host ""
Write-Host "Lambda code package ready for deployment!" -ForegroundColor Green