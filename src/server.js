require('dotenv').config();
const app = require('./app');
const { connectDatabase } = require('./config/database');
const logger = require('./utils/logger');
const { initBillingCron } = require('./services/billingCron');
const { initNoticeCron } = require('./services/noticeCron');
const backupService = require('./services/backupService');
const seedNiches = require('./utils/seedNiches');

const PORT = process.env.PORT || 3000;

// Validate required environment variables
const requiredEnvVars = ['MONGODB_URI'];

// Check Firebase configuration - either service account path OR individual variables
const hasServiceAccountPath = !!process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const hasIndividualFirebaseVars = !!(
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
);

if (!hasServiceAccountPath && !hasIndividualFirebaseVars) {
  logger.error('Missing Firebase configuration', {
    message: 'Please provide either FIREBASE_SERVICE_ACCOUNT_PATH or all of (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)'
  });
  process.exit(1);
}

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  logger.error('Missing required environment variables', {
    missing: missingEnvVars
  });
  process.exit(1);
}

// Connect to database and start server
connectDatabase()
  .then(() => {
    const server = app.listen(PORT, '0.0.0.0', async () => {
      logger.info(`Server started on port ${PORT}`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development'
      });
      
      // Seed initial niche types
      await seedNiches();
      
      // Initialize background jobs
      initBillingCron();
      initNoticeCron();
      backupService.init();
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} received, starting graceful shutdown`);

      server.close(async () => {
        logger.info('HTTP server closed');

        // Close database connection
        const mongoose = require('mongoose');
        try {
          await mongoose.connection.close();
          logger.info('MongoDB connection closed');
          process.exit(0);
        } catch (error) {
          logger.error('Error closing MongoDB connection', { error: error.message });
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Listen for termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      gracefulShutdown('unhandledRejection');
    });
  })
  .catch((error) => {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  });
