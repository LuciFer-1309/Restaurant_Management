require('dotenv').config();
const app = require('./app');
const { pool } = require('./config/db');

const PORT = process.env.PORT || 5000;

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`Restaurant Management System Backend Server`);
  console.log(`Running on: http://localhost:${PORT}`);
  console.log(`Health Check: http://localhost:${PORT}/api/health`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('====================================================');
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\nReceived ${signal}. Closing HTTP server and PostgreSQL pool gracefully...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    try {
      await pool.end();
      console.log('PostgreSQL client pool closed.');
      process.exit(0);
    } catch (err) {
      console.error('Error closing database pool:', err);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

