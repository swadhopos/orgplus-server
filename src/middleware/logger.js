const { logger, generateRequestId } = require('../utils/logger');
const { maskData } = require('../utils/masking');

/**
 * Middleware to log incoming requests and responses
 * 
 * Generates a unique request ID, logs request details (method, path, query, body, user info),
 * and logs response details (status code, body, duration) when the response finishes.
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
    body: maskData(req.body),
    userId: req.user?.uid || null,
    role: req.user?.role || null,
    orgId: req.user?.orgId || null,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('user-agent')
  });

  // Track response body
  const originalSend = res.send;
  const originalJson = res.json;
  let responseBody;

  res.send = function(body) {
    responseBody = body;
    return originalSend.apply(res, arguments);
  };

  res.json = function(body) {
    responseBody = body;
    return originalJson.apply(res, arguments);
  };

  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.id);

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;

    // Parse response body if it's a string (e.g. from res.send)
    let parsedBody = responseBody;
    if (typeof responseBody === 'string') {
      try {
        parsedBody = JSON.parse(responseBody);
      } catch (e) {
        // Keep as string if not JSON
      }
    }

    logger.info('Response finished', {
      type: 'response',
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      body: maskData(parsedBody),
      duration,
      userId: req.user?.uid || null
    });
  });

  next();
};

module.exports = {
  requestLogger
};
