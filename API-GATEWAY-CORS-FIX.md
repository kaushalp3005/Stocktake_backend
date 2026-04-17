# API Gateway CORS Configuration Fix

## Problem
The CORS error is happening at the API Gateway level before requests reach Lambda.

## Solution: Enable CORS in API Gateway Console

### Step 1: Access API Gateway
1. Go to AWS Console → API Gateway
2. Find your API: `stocktake-api` or similar 
3. Click on your API name

### Step 2: Enable CORS for the root resource
1. Click on the root resource (`/` or `/{proxy+}`)
2. Click **Actions** → **Enable CORS**
3. Configure CORS settings:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With,Accept,Origin
Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
```

### Step 3: For HTTP API (if using HTTP API instead of REST API)
1. Go to **CORS** section in left sidebar
2. Add allowed origins:
   - `https://stockstake.netlify.app`
   - `https://stocktake.netlify.app`
   - `*` (for testing)
3. Add allowed headers:
   - `content-type`
   - `authorization` 
   - `x-requested-with`
   - `x-api-key`
4. Add allowed methods: `GET, POST, PUT, PATCH, DELETE, OPTIONS`

### Step 4: Deploy Changes
1. Click **Actions** → **Deploy API**
2. Select deployment stage (usually `prod`)
3. Click **Deploy**

### Step 5: Test CORS
Test with curl:
```bash
curl -X OPTIONS \
  -H "Origin: https://stockstake.netlify.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  -v https://ogj0f6xitg.execute-api.ap-south-1.amazonaws.com/prod/api/auth/login
```

Should return 200 with CORS headers.

### Alternative: Quick Fix with serverless-http
If the above doesn't work, the issue might be with serverless-http not handling OPTIONS properly.

## Emergency Workaround
Create a simple CloudFlare proxy or use a CORS proxy service temporarily while fixing the API Gateway configuration.