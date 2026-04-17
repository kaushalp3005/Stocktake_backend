// Simple Lambda handler that should work
const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');

// Create Express app directly instead of importing
const app = express();

// CORS middleware
app.use(cors());

// Body parsing middleware  
app.use(express.json());

// Fix for Buffer body parsing from API Gateway
app.use((req, res, next) => {
  console.log('Request received:', {
    method: req.method,
    path: req.path,
    bodyType: typeof req.body,
    isBuffer: Buffer.isBuffer(req.body),
    body: req.body
  });
  
  if (req.body && Buffer.isBuffer(req.body)) {
    try {
      const bodyString = req.body.toString('utf8');
      console.log('Converting Buffer:', bodyString);
      req.body = JSON.parse(bodyString);
      console.log('Parsed body:', req.body);
    } catch (error) {
      console.log('Parse error:', error);
    }
  }
  next();
});

// Simple test route
app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong' });
});

// Login route
app.post('/api/auth/login', (req, res) => {
  console.log('Login request:', {
    body: req.body,
    hasUsername: !!req.body?.username,
    hasPassword: !!req.body?.password
  });
  
  const { username, password } = req.body || {};
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  if (username === 'shakirashaikh' && password === 'shakirashaikh') {
    return res.json({ 
      token: 'dummy-token-12345',
      user: { id: 1, username: 'shakirashaikh', role: 'admin' }
    });
  }
  
  return res.status(401).json({ error: 'Invalid credentials' });
});

// Export handler
module.exports.handler = serverless(app);