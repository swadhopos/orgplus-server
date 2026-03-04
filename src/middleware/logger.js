/**
 * Request Logger Middleware for OrgPlus Multi-Tenant System
 * 
 * This middleware logs all incoming requests and responses for monitoring and debugging.
 * It generates a unique request ID for each request, logs request details, and measures response time.
 */

const { logger, generateRequestId } = require('../utils/logger');

/**
 * Middleware to log incoming requests and responses
 * 
 * Generates a unique request ID, logs request details (method, path, query, user info),
 * and logs response details (status code, duration) when the response finishes.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const requestLogger = (req, res, next) => {
  // Generate unique request ID
  req.id = generateRequestId();
  const start = Date.now();

  // Log incoming request
  logger.info('Incoming request', {
    type: 'request',
    requestId: req.id,
    method: req.method,
    path: req.path,
    url: req.originalUrl,
    query: req.query,
    userId: req.user?.uid || null,
    role: req.user?.role || null,
    orgId: req.user?.orgId || null,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('user-agent')
  });

  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.id);

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;

    logger.info('Response finished', {
      type: 'response',
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.uid || null
    });
  });

  next();
};

module.exports = {
  requestLogger
};
