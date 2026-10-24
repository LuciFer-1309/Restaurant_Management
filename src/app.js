const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Route modules
const customersRoutes = require('./routes/customers.routes');
const menuRoutes = require('./routes/menu.routes');
const tablesRoutes = require('./routes/tables.routes');
const reservationsRoutes = require('./routes/reservations.routes');
const ordersRoutes = require('./routes/orders.routes');
const paymentsRoutes = require('./routes/payments.routes');

const app = express();

// Enable CORS for frontend-backend interaction
app.use(cors());

// Parse incoming JSON and urlencoded payloads
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint (checks server status and PostgreSQL connectivity)
app.get('/api/health', async (req, res) => {
  try {
    const dbRes = await db.query('SELECT NOW() AS current_time');
    return res.status(200).json({
      success: true,
      message: 'Restaurant Management Backend is healthy',
      data: {
        server_status: 'online',
        database: 'connected',
        server_timestamp: new Date().toISOString(),
        db_timestamp: dbRes.rows[0].current_time,
      },
    });
  } catch (err) {
    return res.status(503).json({
      success: false,
      message: 'Server is running, but database connection failed',
      data: {
        server_status: 'online',
        database: 'disconnected',
        error: process.env.NODE_ENV !== 'production' ? err.message : undefined,
      },
    });
  }
});

// Mount Resource API Routes
app.use('/api/customers', customersRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/tables', tablesRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payments', paymentsRoutes);

// Catch-all 404 handler for undefined endpoints
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint '${req.method} ${req.originalUrl}' does not exist`,
  });
});

// Centralized error handler middleware
app.use(errorHandler);

module.exports = app;

