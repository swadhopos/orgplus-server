/**
 * Unit tests for Request Logger Middleware
 */

import { jest } from '@jest/globals';

// Mock the logger module before importing the middleware
const mockLogger = {
  info: jest.fn()
};

const mockGenerateRequestId = jest.fn(() => 'test-request-id-123');

jest.unstable_mockModule('../../utils/logger.js', () => ({
  logger: mockLogger,
  generateRequestId: mockGenerateRequestId
}));

// Import after mocking
const { requestLogger } = await import('../logger.js');

describe('Request Logger Middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockLogger.info.mockClear();
    mockGenerateRequestId.mockClear();
    mockGenerateRequestId.mockReturnValue('test-request-id-123');

    // Mock request object
    req = {
      method: 'GET',
      path: '/api/organizations',
      originalUrl: '/api/organizations?page=1',
      query: { page: '1' },
      ip: '127.0.0.1',
      get: jest.fn((header) => {
        if (header === 'user-agent') return 'Mozilla/5.0';
        return null;
      }),
      connection: {
        remoteAddress: '127.0.0.1'
      }
    };

    // Mock response object
    res = {
      setHeader: jest.fn(),
      on: jest.fn(),
      statusCode: 200
    };

    // Mock next function
    next = jest.fn();
  });

  describe('Request ID Generation', () => {
    it('should generate and attach a unique request ID to req.id', () => {
      requestLogger(req, res, next);

      expect(req.id).toBe('test-request-id-123');
      expect(mockGenerateRequestId).toHaveBeenCalledTimes(1);
    });

    it('should add request ID to response headers', () => {
      requestLogger(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'test-request-id-123');
    });
  });

  describe('Request Logging', () => {
    it('should log incoming request with method, path, and query', () => {
      requestLogger(req, res, next);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'request',
          requestId: 'test-request-id-123',
          method: 'GET',
          path: '/api/organizations',
          url: '/api/organizations?page=1',
          query: { page: '1' }
        })
      );
    });

    it('should log request with user info when user is authenticated', () => {
      req.user = {
        uid: 'user-123',
        role: 'admin',
        orgId: 'org-456'
      };

      requestLogger(req, res, next);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'request',
          userId: 'user-123',
          role: 'admin',
          orgId: 'org-456'
        })
      );
    });

    it('should log request with null user info when user is not authenticated', () => {
      requestLogger(req, res, next);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'request',
          userId: null,
          role: null,
          orgId: null
        })
      );
    });

    it('should log IP address and user agent', () => {
      requestLogger(req, res, next);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'request',
          ip: '127.0.0.1',
          userAgent: 'Mozilla/5.0'
        })
      );
    });
  });

  describe('Response Logging', () => {
    it('should register a finish event listener on response', () => {
      requestLogger(req, res, next);

      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('should log response with status code and duration when response finishes', () => {
      requestLogger(req, res, next);

      // Get the finish callback
      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];

      // Simulate response finishing
      res.statusCode = 200;
      finishCallback();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'response',
          requestId: 'test-request-id-123',
          method: 'GET',
          path: '/api/organizations',
          statusCode: 200,
          duration: expect.any(Number)
        })
      );
    });

    it('should log response with user ID when user is authenticated', () => {
      req.user = {
        uid: 'user-123',
        role: 'admin'
      };

      requestLogger(req, res, next);

      // Get the finish callback
      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'response',
          userId: 'user-123'
        })
      );
    });

    it('should log response with null user ID when user is not authenticated', () => {
      requestLogger(req, res, next);

      // Get the finish callback
      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'response',
          userId: null
        })
      );
    });

    it('should log different status codes correctly', () => {
      requestLogger(req, res, next);

      // Get the finish callback
      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];

      // Test 404
      res.statusCode = 404;
      finishCallback();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'response',
          statusCode: 404
        })
      );
    });
  });

  describe('Middleware Flow', () => {
    it('should call next() to continue middleware chain', () => {
      requestLogger(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });

    it('should not block the middleware chain', () => {
      requestLogger(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing connection object gracefully', () => {
      delete req.connection;

      expect(() => requestLogger(req, res, next)).not.toThrow();
      expect(next).toHaveBeenCalled();
    });

    it('should handle missing user-agent header', () => {
      req.get = jest.fn(() => null);

      expect(() => requestLogger(req, res, next)).not.toThrow();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'request',
          userAgent: null
        })
      );
    });

    it('should handle POST requests with body', () => {
      req.method = 'POST';
      req.path = '/api/organizations';
      req.body = { name: 'Test Org' };

      requestLogger(req, res, next);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'request',
          method: 'POST',
          path: '/api/organizations'
        })
      );
    });
  });
});
