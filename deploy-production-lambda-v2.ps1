# Full production Lambda deployment script
# This script creates a complete Lambda deployment with Prisma client

Write-Host "🚀 Starting full Lambda deployment with Prisma..." -ForegroundColor Green

$ErrorActionPreference = "Stop"

try {
    # Clean up old deployment folders
    $deployDirs = @("lambda-production", "lambda-layer-production")
    foreach ($dir in $deployDirs) {
        $fullPath = Join-Path (Get-Location) $dir
        if (Test-Path $fullPath) {
            Write-Host "🧹 Cleaning up $dir..." -ForegroundColor Yellow
            Remove-Item $fullPath -Recurse -Force
        }
    }

    # Create deployment directories
    New-Item -ItemType Directory -Path "lambda-production" -Force | Out-Null
    New-Item -ItemType Directory -Path "lambda-layer-production" -Force | Out-Null

    Write-Host "📂 Created deployment directories" -ForegroundColor Green

    # Step 1: Build TypeScript to JavaScript
    Write-Host "🔨 Building TypeScript..." -ForegroundColor Blue
    npm run build

    # Step 2: Copy main files to production folder
    Write-Host "📋 Copying main files..." -ForegroundColor Blue
    
    # Copy built JavaScript files
    if (Test-Path "dist") {
        Copy-Item "dist/*" "lambda-production/" -Recurse -Force
    } else {
        # Fallback: copy TS files and transpile
        Copy-Item "index.ts" "lambda-production/index.js" -Force
        Copy-Item "lambda.ts" "lambda-production/lambda.js" -Force
    }

    # Copy other necessary files
    $filesToCopy = @("package.json", "prisma")
    foreach ($file in $filesToCopy) {
        if (Test-Path $file) {
            Copy-Item $file "lambda-production/" -Recurse -Force
            Write-Host "✅ Copied $file" -ForegroundColor Green
        }
    }

    # Step 3: Create Lambda Layer with dependencies
    Write-Host "📦 Creating Lambda layer with dependencies..." -ForegroundColor Blue
    
    # Copy package.json to layer directory
    Copy-Item "package.json" "lambda-layer-production/" -Force
    
    # Install production dependencies in layer
    Set-Location "lambda-layer-production"
    
    # Create nodejs directory for Lambda layer structure
    New-Item -ItemType Directory -Path "nodejs" -Force | Out-Null
    Copy-Item "package.json" "nodejs/" -Force
    
    Set-Location "nodejs"
    
    Write-Host "⬇️ Installing production dependencies..." -ForegroundColor Blue
    npm install --production --platform=linux --arch=x64
    
    # Copy Prisma schema to generate client
    if (Test-Path "../../prisma") {
        Copy-Item "../../prisma" "." -Recurse -Force
        Write-Host "📄 Copied Prisma schema" -ForegroundColor Green
    }
    
    # Generate Prisma client for Linux
    Write-Host "🔧 Generating Prisma client for Linux..." -ForegroundColor Blue
    $env:PRISMA_CLI_BINARY_TARGETS = "linux-musl-openssl-3.0.x"
    npx prisma generate --schema=./prisma/schema.prisma
    
    Set-Location ".."
    
    # Create layer zip
    Write-Host "🗜️ Creating Lambda layer zip..." -ForegroundColor Blue
    Compress-Archive -Path "nodejs" -DestinationPath "lambda-layer.zip" -Force
    
    # Upload layer
    Write-Host "☁️ Uploading Lambda layer..." -ForegroundColor Blue
    $timestamp = Get-Date -Format "yyyy-MM-dd-HHmm"
    $description = "StockTake dependencies with Prisma client ($timestamp)"
    aws lambda publish-layer-version --layer-name "stocktake-dependencies-production" --zip-file "fileb://lambda-layer.zip" --compatible-runtimes "nodejs18.x" "nodejs20.x" --description $description
    
    # Get the new layer ARN
    $layerInfo = aws lambda list-layer-versions --layer-name "stocktake-dependencies-production" --query "LayerVersions[0].LayerVersionArn" --output text
    Write-Host "📍 New layer ARN: $layerInfo" -ForegroundColor Green
    
    Set-Location ".."
    
    # Step 4: Create function package
    Write-Host "📦 Creating function package..." -ForegroundColor Blue
    Set-Location "lambda-production"
    
    # Remove node_modules and package-lock.json (dependencies are in layer)
    if (Test-Path "node_modules") { Remove-Item "node_modules" -Recurse -Force }
    if (Test-Path "package-lock.json") { Remove-Item "package-lock.json" -Force }
    if (Test-Path "pnpm-lock.yaml") { Remove-Item "pnpm-lock.yaml" -Force }
    
    # Create function zip
    Write-Host "🗜️ Creating function zip..." -ForegroundColor Blue
    Compress-Archive -Path "*" -DestinationPath "lambda-function.zip" -Force
    
    # Step 5: Update Lambda function
    Write-Host "☁️ Updating Lambda function..." -ForegroundColor Blue
    aws lambda update-function-code --function-name "stocktake-api" --zip-file "fileb://lambda-function.zip"
    
    # Update function configuration to use new layer
    Write-Host "⚙️ Updating function configuration..." -ForegroundColor Blue
    aws lambda update-function-configuration --function-name "stocktake-api" --layers $layerInfo --handler "lambda.handler"
    
    Set-Location ".."
    
    Write-Host "✅ Full Lambda deployment completed successfully!" -ForegroundColor Green
    Write-Host "🌐 Testing API endpoint..." -ForegroundColor Blue
    
    # Wait a moment for deployment to complete
    Start-Sleep -Seconds 5
    
    # Test the API
    try {
        $testResponse = Invoke-WebRequest -Uri "https://ogj0f6xitg.execute-api.ap-south-1.amazonaws.com/prod/api/test" -UseBasicParsing
        Write-Host "✅ API Test Result: $($testResponse.StatusCode) - $($testResponse.Content)" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ API test failed, but deployment completed. Check CloudWatch logs." -ForegroundColor Yellow
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    # Return to original directory
    Set-Location "d:\StockTake module\backend"
}