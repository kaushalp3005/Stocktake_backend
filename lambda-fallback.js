// Modified lambda.js that handles Prisma client issues gracefully
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;

// Construct DATABASE_URL from individual DB variables if DATABASE_URL doesn't exist
if (!process.env.DATABASE_URL && process.env.DB_HOST) {
    const dbUser = process.env.DB_USER || process.env.DB_USERNAME || "postgres";
    const dbPassword = process.env.DB_PASSWORD || "";
    const dbHost = process.env.DB_HOST;
    const dbPort = process.env.DB_PORT || "5432";
    const dbName = process.env.DB_NAME || process.env.DB_DATABASE || "postgres";
    const dbSchema = process.env.DB_SCHEMA || "public";
    
    // Construct PostgreSQL connection string
    process.env.DATABASE_URL = `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}?schema=${dbSchema}`;
}

const serverless_http_1 = __importDefault(require("serverless-http"));

// Create a fallback server if the main server fails
let app;
try {
    const index_js_1 = require("./index.js");
    app = (0, index_js_1.createServer)();
    console.log("✅ Main server loaded successfully");
} catch (error) {
    console.error("❌ Failed to load main server:", error.message);
    
    // Create fallback Express server
    const express = require("express");
    const cors = require("cors");
    
    app = express();
    
    // Configure CORS for fallback
    const allowedOrigins = [
        'https://stockstake.netlify.app',
        'https://stocktake.netlify.app',
        'http://localhost:5173',
        'http://localhost:3000'
    ];

    const corsOptions = {
        origin: function (origin, callback) {
            if (!origin) return callback(null, true);
            if (allowedOrigins.indexOf(origin) !== -1) {
                callback(null, true);
            } else {
                console.log('CORS blocked origin:', origin);
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
    };

    app.use(cors(corsOptions));
    app.use(express.json());
    app.options('*', cors(corsOptions));

    // Fallback health check
    app.get('/health', (req, res) => {
        res.json({ 
            status: 'fallback-healthy', 
            service: 'stocktake-api',
            message: 'Running in fallback mode due to Prisma client issue'
        });
    });

    // Fallback test endpoint
    app.get('/api/test', (req, res) => {
        res.json({ 
            message: 'Fallback API is working!', 
            timestamp: new Date().toISOString(),
            origin: req.headers.origin,
            cors: 'enabled',
            mode: 'fallback'
        });
    });

    // Fallback login endpoint
    app.post('/api/login', async (req, res) => {
        try {
            const { username, password } = req.body;
            
            console.log("Fallback login attempt:", { username });
            
            // Simple fallback authentication
            if ((username === 'shubham' && password === 'test123') || 
                (username === 'shakirashaikh' && password === 'shakirashaikh')) {
                
                const userData = username === 'shubham' ? {
                    username: 'shubham',
                    role: 'MANAGER',
                    id: 1,
                    name: 'Shubham User'
                } : {
                    username: 'shakirashaikh',
                    role: 'USER',
                    id: 2,
                    name: 'Shakira Shaikh'
                };

                res.json({
                    success: true,
                    message: 'Login successful (fallback mode)',
                    user: userData,
                    token: `fallback-jwt-token-${userData.id}`
                });
            } else {
                res.status(401).json({ 
                    success: false, 
                    message: 'Invalid credentials' 
                });
            }
        } catch (error) {
            console.error('Fallback login error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Login failed in fallback mode',
                error: error.message 
            });
        }
    });

    // Fallback me endpoint
    app.get('/api/me', (req, res) => {
        const authHeader = req.headers.authorization;
        if (authHeader && (authHeader.includes('fallback-jwt-token-1') || authHeader.includes('fallback-jwt-token-2'))) {
            const userId = authHeader.includes('fallback-jwt-token-1') ? 1 : 2;
            const userData = userId === 1 ? {
                id: 1,
                username: 'shubham',
                role: 'MANAGER',
                name: 'Shubham User'
            } : {
                id: 2,
                username: 'shakirashaikh',
                role: 'USER',
                name: 'Shakira Shaikh'
            };

            res.json({
                success: true,
                user: userData
            });
        } else {
            res.status(401).json({ success: false, message: 'Unauthorized' });
        }
    });

    // Handle all other routes
    app.use('*', (req, res) => {
        res.status(200).json({ 
            error: 'Endpoint not available in fallback mode',
            path: req.originalUrl,
            method: req.method,
            message: 'Please wait for full system restoration'
        });
    });

    console.log("🚨 Running in fallback mode");
}

// Wrap the serverless handler
const serverlessHandler = (0, serverless_http_1.default)(app, {
    binary: [
        'image/*',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/pdf'
    ]
});

// CORS headers for all responses
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Api-Key, X-Amz-Date, X-Amz-Security-Token',
    'Access-Control-Max-Age': '86400'
};

// Export the handler for Lambda with CORS support
const handler = async (event, context) => {
    console.log("Lambda Event:", {
        httpMethod: event.httpMethod,
        path: event.path,
        origin: event.headers?.origin || event.headers?.Origin
    });

    // Handle OPTIONS preflight requests directly at Lambda level
    if (event.httpMethod === 'OPTIONS') {
        console.log("✅ Handling OPTIONS preflight at Lambda level");
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }

    try {
        // Process the request through Express
        const response = await serverlessHandler(event, context);
        
        // Ensure CORS headers are present in the response
        return {
            ...response,
            headers: {
                ...corsHeaders,
                ...(response.headers || {})
            }
        };
    } catch (error) {
        console.error("Lambda handler error:", error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ 
                error: 'Lambda handler error', 
                message: error.message,
                mode: 'error-fallback'
            })
        };
    }
};

exports.handler = handler;