/**
 * Unit Tests for Error Handler Middleware
 */

import {
  errorHandler,
  notFoundHandler
} from '../errorHandler.js';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  NotFoundError
} from '../../utils/errors.js';
import logger from '../../utils/logger.js';

// Store original logger methods
const originalError = logger.error;
const originalWarn = logger.warn;
const originalInfo = logger.info;

describe('Error Handler Middleware', () => {
  let req, res, next;
  let loggerCalls;

  beforeEach(() => {
    // Track logger calls
    loggerCalls = {
      error: [],
      warn: [],
      info: []
    };

    // Mock logger methods
    logger.error = (...args) => loggerCalls.error.push(args);
    logger.warn = (...args) => loggerCalls.warn.push(args);
    logger.info = (...args) => loggerCalls.info.push(args);
    
    // Mock request object
    req = {
      id: 'test-request-id',
      path: '/api/test',
      method: 'GET',
      user: {
        uid: 'test-user-id'
      }
    };

    // Mock response object
    res = {
      statusCode: null,
      jsonData: null,
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.jsonData = data;
        return this;
      }
    };

    // Mock next function
    next = (error) => {
      next.called = true;
      next.error = error;
    };
  });

  afterEach(() => {
    // Restore original logger methods
    logger.error = originalError;
    logger.warn = originalWarn;
    logger.info = originalInfo;
  });

  describe('errorHandler', () => {
    it('should handle AppError with all properties', () => {
      const error = new ValidationError('Invalid input', [
        { field: 'email', message: 'Email is required' }
      ]);

      errorHandler(error, req, res, next);

      expect(loggerCalls.warn.length).toBe(1);
      expect(loggerCalls.warn[0][0]).toBe('Client error occurred');
      expect(loggerCalls.warn[0][1]).toMatchObject({
        message: 'Invalid input',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        requestId: 'test-request-id',
        userId: 'test-user-id',
        path: '/api/test',
        method: 'GET',
        isOperational: true
      });

      expect(res.statusCode).toBe(400);
      expect(res.jsonData).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: [{ field: 'email', message: 'Email is required' }],
          requestId: 'test-request-id'
        }
      });
    });

    it('should handle AuthenticationError', () => {
      const error = new AuthenticationError('Invalid token');

      errorHandler(error, req, res, next);

      expect(loggerCalls.warn.length).toBe(1);
      expect(res.statusCode).toBe(401);
      expect(res.jsonData).toEqual({
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Invalid token',
          details: null,
          requestId: 'test-request-id'
        }
      });
    });

    it('should handle NotFoundError', () => {
      const error = new NotFoundError('Organization not found');

      errorHandler(error, req, res, next);

      expect(loggerCalls.warn.length).toBe(1);
      expect(res.statusCode).toBe(404);
      expect(res.jsonData).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Organization not found',
          details: null,
          requestId: 'test-request-id'
        }
      });
    });

    it('should handle server errors (500+) and log as error', () => {
      const error = new AppError('Database error', 500, 'DB_ERROR');

      errorHandler(error, req, res, next);

      expect(loggerCalls.error.length).toBe(1);
      expect(loggerCalls.error[0][0]).toBe('Server error occurred');
      expect(loggerCalls.error[0][1]).toMatchObject({
        statusCode: 500,
        code: 'DB_ERROR'
      });

      expect(res.statusCode).toBe(500);
    });

    it('should handle unknown errors with default values', () => {
      const error = new Error('Unknown error');

      errorHandler(error, req, res, next);

      expect(loggerCalls.error.length).toBe(1);
      expect(res.statusCode).toBe(500);
      expect(res.jsonData).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unknown error',
          details: null,
          requestId: 'test-request-id'
        }
      });
    });

    it('should handle errors without user context', () => {
      const error = new ValidationError('Invalid input');
      req.user = undefined;

      errorHandler(error, req, res, next);

      expect(loggerCalls.warn.length).toBe(1);
      expect(loggerCalls.warn[0][1].userId).toBeUndefined();

      expect(res.statusCode).toBe(400);
    });

    it('should hide internal error details in production for non-operational errors', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Internal database error');
      error.isOperational = false;

      errorHandler(error, req, res, next);

      expect(res.jsonData).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          details: null,
          requestId: 'test-request-id'
        }
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should expose operational error details in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new ValidationError('Invalid email format', { field: 'email' });

      errorHandler(error, req, res, next);

      expect(res.jsonData).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid email format',
          details: { field: 'email' },
          requestId: 'test-request-id'
        }
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should include stack trace in error log', () => {
      const error = new ValidationError('Invalid input');

      errorHandler(error, req, res, next);

      expect(loggerCalls.warn.length).toBe(1);
      expect(loggerCalls.warn[0][1].stack).toBeDefined();
      expect(typeof loggerCalls.warn[0][1].stack).toBe('string');
    });
  });

  describe('notFoundHandler', () => {
    it('should create a 404 error and pass to next middleware', () => {
      notFoundHandler(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeDefined();
      expect(next.error.message).toBe('Route not found: GET /api/test');
      expect(next.error.statusCode).toBe(404);
      expect(next.error.code).toBe('ROUTE_NOT_FOUND');
      expect(next.error.isOperational).toBe(true);
    });

    it('should include request method and path in error message', () => {
      req.method = 'POST';
      req.path = '/api/organizations';

      notFoundHandler(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error.message).toBe('Route not found: POST /api/organizations');
    });
  });
});
