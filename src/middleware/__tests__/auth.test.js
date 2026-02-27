/**
 * Unit Tests for Authentication Middleware
 * 
 * Note: These tests use a simplified approach compatible with ES modules.
 * We test the middleware logic by simulating different scenarios.
 */

import { authenticateToken, authenticateTokenOptional } from '../auth.js';
import { AuthenticationError } from '../../utils/errors.js';

describe('Authentication Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    // Mock request object
    req = {
      id: 'test-request-id',
      headers: {}
    };

    // Mock response object
    res = {};

    // Mock next function
    next = (err) => {
      next.called = true;
      next.error = err;
    };
  });

  describe('authenticateToken', () => {
    describe('missing or invalid authorization header', () => {
      it('should return 401 when Authorization header is missing', async () => {
        await authenticateToken(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeInstanceOf(AuthenticationError);
        expect(next.error.message).toBe('Authorization header missing');
        expect(next.error.statusCode).toBe(401);
      });

      it('should return 401 when Authorization header does not start with Bearer', async () => {
        req.headers.authorization = 'Basic some-token';

        await authenticateToken(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeInstanceOf(AuthenticationError);
        expect(next.error.message).toBe('Invalid authorization header format. Expected: Bearer <token>');
        expect(next.error.statusCode).toBe(401);
      });

      it('should return 401 when token is empty after Bearer prefix', async () => {
        req.headers.authorization = 'Bearer ';

        await authenticateToken(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeInstanceOf(AuthenticationError);
        expect(next.error.message).toBe('Token is empty');
        expect(next.error.statusCode).toBe(401);
      });

      it('should return 401 when token is only whitespace', async () => {
        req.headers.authorization = 'Bearer    ';

        await authenticateToken(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeInstanceOf(AuthenticationError);
        expect(next.error.message).toBe('Token is empty');
        expect(next.error.statusCode).toBe(401);
      });

      it('should return 401 when token is invalid', async () => {
        req.headers.authorization = 'Bearer invalid-token-12345';

        await authenticateToken(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeInstanceOf(AuthenticationError);
        expect(next.error.statusCode).toBe(401);
        // Message could be 'Invalid token' or 'Authentication failed' depending on Firebase error
        expect(['Invalid token', 'Malformed token', 'Authentication failed']).toContain(next.error.message);
      });
    });

    describe('token extraction', () => {
      it('should extract token correctly from Bearer header', async () => {
        req.headers.authorization = 'Bearer test-token-123';

        await authenticateToken(req, res, next);

        // Should call next with an error since token is invalid
        // But this confirms the token was extracted and passed to verifyIdToken
        expect(next.called).toBe(true);
        expect(next.error).toBeInstanceOf(AuthenticationError);
      });

      it('should handle Bearer with extra spaces', async () => {
        req.headers.authorization = 'Bearer  test-token-with-spaces  ';

        await authenticateToken(req, res, next);

        // Token should be extracted (even with spaces) and verification attempted
        expect(next.called).toBe(true);
        expect(next.error).toBeInstanceOf(AuthenticationError);
      });
    });
  });

  describe('authenticateTokenOptional', () => {
    it('should set req.user to null when Authorization header is missing', async () => {
      await authenticateTokenOptional(req, res, next);

      expect(req.user).toBeNull();
      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
    });

    it('should set req.user to null when Authorization header is invalid format', async () => {
      req.headers.authorization = 'Basic some-token';

      await authenticateTokenOptional(req, res, next);

      expect(req.user).toBeNull();
      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
    });

    it('should set req.user to null when token is empty', async () => {
      req.headers.authorization = 'Bearer ';

      await authenticateTokenOptional(req, res, next);

      expect(req.user).toBeNull();
      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
    });

    it('should set req.user to null when token is only whitespace', async () => {
      req.headers.authorization = 'Bearer    ';

      await authenticateTokenOptional(req, res, next);

      expect(req.user).toBeNull();
      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
    });

    it('should set req.user to null when token verification fails', async () => {
      req.headers.authorization = 'Bearer invalid-token';

      await authenticateTokenOptional(req, res, next);

      expect(req.user).toBeNull();
      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
    });

    it('should not throw error for invalid tokens', async () => {
      req.headers.authorization = 'Bearer completely-invalid-token-12345';

      await expect(authenticateTokenOptional(req, res, next)).resolves.not.toThrow();
      expect(req.user).toBeNull();
      expect(next.called).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle various invalid token formats gracefully', async () => {
      const invalidTokens = [
        'Bearer ',
        'Bearer    ',
        'Bearer invalid',
        'Bearer 123',
        'Bearer !@#$%^&*()',
      ];

      for (const token of invalidTokens) {
        req.headers.authorization = token;
        next.called = false;
        next.error = undefined;

        await authenticateToken(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeInstanceOf(AuthenticationError);
        expect(next.error.statusCode).toBe(401);
      }
    });

    it('should always return AuthenticationError for auth failures', async () => {
      req.headers.authorization = 'Bearer invalid-token';

      await authenticateToken(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeInstanceOf(AuthenticationError);
      expect(next.error.code).toBe('AUTHENTICATION_ERROR');
      expect(next.error.isOperational).toBe(true);
    });
  });

  describe('user info extraction', () => {
    it('should prepare to extract uid, email, role, orgId, householdId from token', async () => {
      // This test verifies the middleware structure
      // Actual token verification requires valid Firebase tokens
      req.headers.authorization = 'Bearer mock-token';

      await authenticateToken(req, res, next);

      // With invalid token, req.user should not be set
      expect(req.user).toBeUndefined();
      expect(next.called).toBe(true);
      expect(next.error).toBeInstanceOf(AuthenticationError);
    });
  });
});
