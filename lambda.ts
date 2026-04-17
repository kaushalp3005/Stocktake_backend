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

import serverless from "serverless-http";
import { createServer } from "./index.js";

// Create the Express app
const app = createServer();

// Wrap the serverless handler to add debugging
const serverlessHandler = serverless(app, {
  binary: [
    'image/*',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/pdf'
  ],
  request: function(request: any, event: any) {
    console.log("Serverless request preprocessing:", {
      originalBody: event.body,
      bodyType: typeof event.body,
      contentType: event.headers['content-type'] || event.headers['Content-Type'],
      isBase64: event.isBase64Encoded
    });
    
    // Ensure body is properly parsed for JSON requests
    if (event.body && typeof event.body === 'string' && 
        (event.headers['content-type']?.includes('application/json') || 
         event.headers['Content-Type']?.includes('application/json'))) {
      try {
        const parsedBody = JSON.parse(event.body);
        console.log("Successfully parsed JSON body:", parsedBody);
        request.body = parsedBody;
      } catch (e) {
        console.log("JSON parse error:", e);
      }
    }
  }
});

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Api-Key, X-Amz-Date, X-Amz-Security-Token',
  'Access-Control-Max-Age': '86400'
};

// Export the handler for Lambda with CORS support
export const handler = async (event: any, context: any) => {
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

  // Process the request through Express
  const response = await serverlessHandler(event, context) as any;

  // Ensure CORS headers are present in the response
  return {
    ...response,
    headers: {
      ...corsHeaders,
      ...(response.headers || {})
    }
  };
};
