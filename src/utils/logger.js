const winston = require('winston');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for better readability in development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msgString = typeof message === 'object' ? JSON.stringify(message) : message;
    let msg = `${timestamp} [${level}]: ${msgString}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // Error log file - only errors
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined log file - all logs
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport in non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// Request ID generation utility
const generateRequestId = () => {
  return uuidv4();
};

// Helper function to create child logger with request context
const createRequestLogger = (requestId) => {
  return logger.child({ requestId });
};

module.exports = logger;
module.exports.logger = logger;
module.exports.generateRequestId = generateRequestId;
module.exports.createRequestLogger = createRequestLogger;
