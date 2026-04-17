import "dotenv/config";
import serverless from "serverless-http";
import { createServer } from "./index.js";

// Create the Express app
const app = createServer();

// Fix for API Gateway body parsing - convert Buffer to string
const bodyParsingMiddleware = (req, res, next) => {
  if (req.body && Buffer.isBuffer(req.body)) {
    try {
      // Convert Buffer to string and parse JSON
      const bodyString = req.body.toString('utf8');
      console.log("Converting Buffer to JSON:", bodyString);
      req.body = JSON.parse(bodyString);
      console.log("Successfully parsed body:", req.body);
    } catch (error) {
      console.log("Failed to parse Buffer as JSON:", error);
    }
  }
  next();
};

// Add the middleware before other middlewares
app.use(bodyParsingMiddleware);

// Export the handler
export const handler = serverless(app, {
  binary: [
    'image/*',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/pdf'
  ],
});