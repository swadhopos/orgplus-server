/**
 * Error Handler Middleware for OrgPlus Multi-Tenant System
 * 
 * This middleware provides centralized error handling for all API endpoints.
 * It logs errors with context and returns consistent error responses to clients.
 */

const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * Global Error Handler Middleware
 * 
 * Handles both operational errors (AppError instances) and programmer errors.
 * Logs all errors with request context and returns appropriate HTTP responses.
 * 
 * @param {Error} err - The error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const errorHandler = (err, req, res, next) => {
  // Default to 500 Internal Server Error for unknown errors
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'An unexpected error occurred';
  let details = err.details || null;
  
  // Determine if this is an operational error
  const isOperational = err.isOperational || false;
  
  // Log error with request context
  const errorLog = {
    message: err.message,
    code: code,
    statusCode: statusCode,
    stack: err.stack,
    requestId: req.id,
    userId: req.user?.uid,
    path: req.path,
    method: req.method,
    isOperational: isOperational
  };
  
  // Log at appropriate level based on error type
  if (statusCode >= 500) {
    // Server errors - log as error with full stack trace
    logger.error('Server error occurred', errorLog);
  } else if (statusCode >= 400) {
    // Client errors - log as warning
    logger.warn('Client error occurred', errorLog);
  } else {
    // Other errors - log as info
    logger.info('Error occurred', errorLog);
  }
  
  // Don't expose internal error details in production for programmer errors
  if (!isOperational && process.env.NODE_ENV === 'production') {
    message = 'An unexpected error occurred';
    details = null;
    code = 'INTERNAL_ERROR';
  }
  
  // Send error response
  res.status(statusCode).json({
    error: {
      code: code,
      message: message,
      details: details,
      requestId: req.id
    }
  });
};

/**
 * Handle 404 Not Found errors
 * This middleware should be placed after all route handlers
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(
    `Route not found: ${req.method} ${req.path}`,
    404,
    'ROUTE_NOT_FOUND'
  );
  next(error);
};

/**
 * Handle unhandled promise rejections
 * This should be set up in the main app file
 */
const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason,
      promise: promise
    });
    // In production, you might want to gracefully shut down the server
    // process.exit(1);
  });
};

/**
 * Handle uncaught exceptions
 * This should be set up in the main app file
 */
const handleUncaughtException = () => {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
      message: error.message,
      stack: error.stack
    });
    // Exit process as the application is in an undefined state
    process.exit(1);
  });
};

module.exports = errorHandler;
