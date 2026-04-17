// Local development server
const { createServer } = require('./index.js');

const PORT = process.env.PORT || 8000;

const app = createServer();

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/ping`);
});
