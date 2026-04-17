# Quick production deployment script using existing JavaScript files
Write-Host "Starting production Lambda deployment..." -ForegroundColor Green

$ErrorActionPreference = "Stop"

try {
    # Clean up old deployment folders
    $deployDirs = @("lambda-production", "lambda-layer-production")
    foreach ($dir in $deployDirs) {
        $fullPath = Join-Path (Get-Location) $dir
        if (Test-Path $fullPath) {
            Write-Host "Cleaning up $dir..." -ForegroundColor Yellow
            Remove-Item $fullPath -Recurse -Force
        }
    }

    # Create deployment directories
    New-Item -ItemType Directory -Path "lambda-production" -Force | Out-Null
    New-Item -ItemType Directory -Path "lambda-layer-production" -Force | Out-Null

    Write-Host "Created deployment directories" -ForegroundColor Green

    # Step 1: Copy main files to production folder
    Write-Host "Copying main files..." -ForegroundColor Blue
    
    # Copy essential JavaScript files
    Copy-Item "lambda.js" "lambda-production/" -Force
    Copy-Item "index.js" "lambda-production/" -Force
    Write-Host "Copied main JS files" -ForegroundColor Green

    # Copy other necessary files and folders
    $itemsToCopy = @("package.json", "prisma", "routes", "middleware", "services", "utils", "shared")
    foreach ($item in $itemsToCopy) {
        if (Test-Path $item) {
            Copy-Item $item "lambda-production/" -Recurse -Force
            Write-Host "Copied $item" -ForegroundColor Green
        }
    }

    # Step 2: Create Lambda Layer with dependencies
    Write-Host "Creating Lambda layer with dependencies..." -ForegroundColor Blue
    
    # Copy package.json to layer directory
    Copy-Item "package.json" "lambda-layer-production/" -Force
    
    # Install production dependencies in layer
    Set-Location "lambda-layer-production"
    
    # Create nodejs directory for Lambda layer structure
    New-Item -ItemType Directory -Path "nodejs" -Force | Out-Null
    Copy-Item "package.json" "nodejs/" -Force
    
    Set-Location "nodejs"
    
    Write-Host "Installing production dependencies..." -ForegroundColor Blue
    npm install --production --platform=linux --arch=x64
    
    # Copy Prisma schema to generate client
    if (Test-Path "../../prisma") {
        Copy-Item "../../prisma" "." -Recurse -Force
        Write-Host "Copied Prisma schema" -ForegroundColor Green
        
        # Generate Prisma client for Linux
        Write-Host "Generating Prisma client for Linux..." -ForegroundColor Blue
        npx prisma generate --schema=./prisma/schema.prisma
        Write-Host "Generated Prisma client successfully" -ForegroundColor Green
    }
    
    Set-Location ".."
    
    # Create layer zip
    Write-Host "Creating Lambda layer zip..." -ForegroundColor Blue
    Compress-Archive -Path "nodejs" -DestinationPath "lambda-layer.zip" -Force
    
    # Upload layer
    Write-Host "Uploading Lambda layer..." -ForegroundColor Blue
    $timestamp = Get-Date -Format "yyyy-MM-dd-HHmm"
    $description = "StockTake dependencies with Prisma client $timestamp"
    $layerResult = aws lambda publish-layer-version --layer-name "stocktake-dependencies-production" --zip-file "fileb://lambda-layer.zip" --compatible-runtimes "nodejs18.x" "nodejs20.x" --description "$description"
    
    # Get the new layer ARN
    $layerInfo = aws lambda list-layer-versions --layer-name "stocktake-dependencies-production" --query "LayerVersions[0].LayerVersionArn" --output text
    Write-Host "New layer ARN: $layerInfo" -ForegroundColor Green
    
    Set-Location ".."
    
    # Step 3: Create function package
    Write-Host "Creating function package..." -ForegroundColor Blue
    Set-Location "lambda-production"
    
    # Remove node_modules and lock files (dependencies are in layer)
    $filesToRemove = @("node_modules", "package-lock.json", "pnpm-lock.yaml")
    foreach ($file in $filesToRemove) {
        if (Test-Path $file) { 
            Remove-Item $file -Recurse -Force 
            Write-Host "Removed $file" -ForegroundColor Yellow
        }
    }
    
    # Create function zip
    Write-Host "Creating function zip..." -ForegroundColor Blue
    Compress-Archive -Path "*" -DestinationPath "lambda-function.zip" -Force
    
    # Step 4: Update Lambda function
    Write-Host "Updating Lambda function..." -ForegroundColor Blue
    aws lambda update-function-code --function-name "stocktake-api" --zip-file "fileb://lambda-function.zip"
    
    # Update function configuration to use new layer
    Write-Host "Updating function configuration..." -ForegroundColor Blue
    aws lambda update-function-configuration --function-name "stocktake-api" --layers $layerInfo --handler "lambda.handler"
    
    Set-Location ".."
    
    Write-Host "Full Lambda deployment completed successfully!" -ForegroundColor Green
    Write-Host "Testing API endpoints..." -ForegroundColor Blue
    
    # Wait a moment for deployment to complete
    Start-Sleep -Seconds 15
    
    # Test the health endpoint
    try {
        Write-Host "Testing health endpoint..." -ForegroundColor Blue
        $healthResponse = Invoke-WebRequest -Uri "https://ogj0f6xitg.execute-api.ap-south-1.amazonaws.com/prod/health" -UseBasicParsing
        Write-Host "Health Test: $($healthResponse.StatusCode) - $($healthResponse.Content)" -ForegroundColor Green
    } catch {
        Write-Host "Health test failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    # Test the login endpoint
    try {
        Write-Host "Testing login endpoint..." -ForegroundColor Blue
        $loginResponse = Invoke-WebRequest -Uri "https://ogj0f6xitg.execute-api.ap-south-1.amazonaws.com/prod/api/login" -Method POST -Headers @{"Content-Type"="application/json"; "Origin"="https://stockstake.netlify.app"} -Body '{"username":"test","password":"test"}' -UseBasicParsing
        Write-Host "Login Test: $($loginResponse.StatusCode) - $($loginResponse.Content)" -ForegroundColor Green
    } catch {
        Write-Host "Login test failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    Write-Host "Deployment and testing completed!" -ForegroundColor Green
    
} catch {
    Write-Host "Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Stack trace: $($_.ScriptStackTrace)" -ForegroundColor Red
    exit 1
} finally {
    # Return to original directory
    Set-Location "d:\StockTake module\backend"
}