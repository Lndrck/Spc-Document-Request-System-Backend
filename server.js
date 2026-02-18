/**
 * @fileoverview Main server file for San Pablo Colleges Document Request System API
 * This file sets up the Express server, configures middleware, establishes database connections,
 * and defines the core application structure for the document request management system.
 *
 * Key Features:
 * - Express.js web server setup
 * - CORS configuration for frontend communication
 * - Database connection management with retry logic
 * - Rate limiting for API protection
 * - Request logging and monitoring
 * - Graceful shutdown handling
 * - Health check endpoints
 */

// Import required Node.js modules and dependencies
// Load environment from .env locally
require('dotenv').config();
const env = require('./config/env');
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');

const DatabaseManager = require('./config/db');
const MailService = require('./services/mailer');
const routes = require('./routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const secureMiddleware = require('./middleware/secureMiddleware');
const logger = require('./utils/logger');


const app = express();
const port = process.env.PORT || env.PORT || 5000;

// Health check route for Render/host root
app.get('/', (req, res) => {
  res.status(200).send('Database Manager is running');
});

const httpServer = http.createServer(app);

// Initialize services
const dbManager = new DatabaseManager();
const mailService = new MailService();

// verify optional SMTP connection (non-blocking)
mailService.verifyConnection().catch(err => {
  logger.warn('SMTP verification failed on startup: %s', err.message);
});

// Apply security middlewares configured for production origin
const secure = secureMiddleware(env.FRONTEND_URL);
app.use(secure.helmet);
app.use(secure.cors);
app.use(secure.limiter);

// Body parsing and static
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Simple request logger (kept minimal; use centralized logger)
app.use((req, res, next) => {
  logger.info('%s %s - %s', req.method, req.url, req.ip);
  next();
});

// Dependency injection for handlers
app.use((req, res, next) => {
  req.dbManager = dbManager;
  req.mailService = mailService;
  req.app.locals.dbManager = dbManager;
  req.app.locals.mailService = mailService;
  next();
});

// Mount API routes
app.use('/api', routes);

// Socket.IO (optional)
const io = new Server(httpServer, { cors: { origin: env.FRONTEND_URL || '*' } });
io.on('connection', socket => {
  logger.info('Socket connected: %s', socket.id);
  socket.on('disconnect', () => logger.info('Socket disconnected: %s', socket.id));
});
global.io = io;

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'Smart Registrar API',
    version: '1.0.0',
    database: dbManager.isConnected ? 'connected' : 'disconnected'
  });
});

// 404 + error handlers
app.use(notFound);
app.use(errorHandler);

// Initialize DB and start server
async function initializeApp() {
  try {
    logger.info('Initializing application...');
    dbManager.createConnection();
    await dbManager.connectWithRetry();
    await dbManager.initializeDatabase();
    logger.info('Application initialized');
  } catch (err) {
    logger.error('Initialization failed: %s', err.message);
    // Continue running (useful in dev), but for production exit
    if (process.env.NODE_ENV === 'production') process.exit(1);
  }
}

initializeApp().catch(err => logger.warn('DB init failed: %s', err.message));

httpServer.listen(port, () => {
  logger.info('Server listening on port %d', port);
});

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down server...');
  httpServer.close(() => {
    try {
      if (typeof dbManager.close === 'function') dbManager.close();
    } catch (e) {
      logger.warn('Error closing DB: %s', e.message);
    }
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = app;
