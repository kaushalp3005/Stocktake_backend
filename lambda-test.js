// Simple Lambda handler for testing (no database dependencies)
const serverlessHttp = require('serverless-http');

// Simple Express app for testing
function createTestApp() {
  const express = require('express');
  const app = express();
  
  // Global CORS headers
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    
    if (req.method === 'OPTIONS') {
      console.log('🔧 Handling OPTIONS request');
      return res.status(200).end();
    }
    next();
  });

  app.use(express.json());

  // Simple test endpoints (no database)
  app.get('/api/ping', (req, res) => {
    console.log('✅ Ping endpoint called');
    res.json({ 
      message: 'pong',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown'
    });
  });

  app.get('/api/test', (req, res) => {
    console.log('✅ Test endpoint called');
    res.json({ 
      message: 'Lambda is working',
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        hasDB: !!process.env.DATABASE_URL,
        hasJWT: !!process.env.JWT_SECRET
      }
    });
  });

  // Simple auth test (no database)
  app.post('/api/auth/test', (req, res) => {
    console.log('✅ Auth test endpoint called');
    res.json({ 
      message: 'Auth endpoint working',
      body: req.body 
    });
  });

  return app;
}

// Create serverless handler
const testApp = createTestApp();
const serverlessHandler = serverlessHttp(testApp);

// Export handler with CORS at Lambda level
exports.handler = async (event, context) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
        'Content-Type': 'application/json'
    };

    console.log('🚀 Test Lambda Event:', {
        httpMethod: event.httpMethod,
        path: event.path,
        origin: event.headers?.origin
    });

    // Handle OPTIONS at Lambda level
    if (event.httpMethod === 'OPTIONS') {
        console.log('🔧 Lambda handling OPTIONS');
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'CORS preflight OK' })
        };
    }

    try {
        console.log('📨 Processing request...');
        const response = await serverlessHandler(event, context);
        
        // Add CORS headers to response
        const finalResponse = {
            ...response,
            headers: {
                ...corsHeaders,
                ...(response?.headers || {})
            }
        };
        
        console.log('✅ Response status:', finalResponse.statusCode);
        return finalResponse;
        
    } catch (error) {
        console.error('❌ Lambda error:', error.message);
        console.error('Stack:', error.stack);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ 
                error: 'Internal Server Error',
                message: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
};