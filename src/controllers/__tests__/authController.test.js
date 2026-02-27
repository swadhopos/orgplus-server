/**
 * Integration Tests for Authentication Controller
 * 
 * Tests the bootstrap endpoint functionality including:
 * - Successful bootstrap creation
 * - Rejection when system admin already exists
 * - Proper logging of bootstrap attempts
 */

import { jest } from '@jest/globals';

// Mock dependencies before importing controller
const mockCreateUser = jest.fn();
const mockSetCustomClaims = jest.fn();
const mockGetUserByEmail = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerError = jest.fn();

jest.unstable_mockModule('../../config/firebase.js', () => ({
  createUser: mockCreateUser,
  setCustomClaims: mockSetCustomClaims,
  getUserByEmail: mockGetUserByEmail
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError
  }
}));

// Import controller after mocking
const { bootstrap } = await import('../authController.js');
const { ConflictError } = await import('../../utils/errors.js');

describe('Auth Controller - Bootstrap', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup request, response, and next mocks
    req = {
      id: 'test-request-id'
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    next = jest.fn();

    // Reset environment
    process.env.BOOTSTRAP_PASSWORD = 'TestPassword123!';
  });

  describe('Successful Bootstrap', () => {
    test('should create system admin user when no user exists', async () => {
      // Mock: No existing user
      mockGetUserByEmail.mockResolvedValue(null);

      // Mock: User creation
      const mockUserRecord = {
        uid: 'test-uid-123',
        email: 'nksuhail13@gmail.com'
      };
      mockCreateUser.mockResolvedValue(mockUserRecord);

      // Mock: Set custom claims
      mockSetCustomClaims.mockResolvedValue();

      // Execute
      await bootstrap(req, res, next);

      // Assertions
      expect(mockGetUserByEmail).toHaveBeenCalledWith('nksuhail13@gmail.com');
      expect(mockCreateUser).toHaveBeenCalledWith('nksuhail13@gmail.com', 'TestPassword123!');
      expect(mockSetCustomClaims).toHaveBeenCalledWith('test-uid-123', { role: 'systemAdmin' });
      
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'System admin user created successfully',
        data: {
          userId: 'test-uid-123',
          email: 'nksuhail13@gmail.com',
          role: 'systemAdmin'
        }
      });

      expect(next).not.toHaveBeenCalled();
      expect(mockLoggerInfo).toHaveBeenCalled();
    });

    test('should upgrade existing user without systemAdmin role', async () => {
      // Mock: Existing user without systemAdmin role
      const existingUser = {
        uid: 'existing-uid-456',
        email: 'nksuhail13@gmail.com',
        customClaims: { role: 'admin', orgId: 'org123' }
      };
      mockGetUserByEmail.mockResolvedValue(existingUser);

      // Mock: Set custom claims
      mockSetCustomClaims.mockResolvedValue();

      // Execute
      await bootstrap(req, res, next);

      // Assertions
      expect(mockGetUserByEmail).toHaveBeenCalledWith('nksuhail13@gmail.com');
      expect(mockCreateUser).not.toHaveBeenCalled();
      expect(mockSetCustomClaims).toHaveBeenCalledWith('existing-uid-456', { role: 'systemAdmin' });
      
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'System admin user upgraded successfully',
        data: {
          userId: 'existing-uid-456',
          email: 'nksuhail13@gmail.com',
          role: 'systemAdmin'
        }
      });

      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Bootstrap Rejection', () => {
    test('should reject when system admin already exists', async () => {
      // Mock: Existing system admin
      const existingSystemAdmin = {
        uid: 'system-admin-uid',
        email: 'nksuhail13@gmail.com',
        customClaims: { role: 'systemAdmin' }
      };
      mockGetUserByEmail.mockResolvedValue(existingSystemAdmin);

      // Execute
      await bootstrap(req, res, next);

      // Assertions
      expect(mockGetUserByEmail).toHaveBeenCalledWith('nksuhail13@gmail.com');
      expect(mockCreateUser).not.toHaveBeenCalled();
      expect(mockSetCustomClaims).not.toHaveBeenCalled();
      
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      
      expect(next).toHaveBeenCalledWith(expect.any(ConflictError));
      expect(mockLoggerWarn).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle Firebase user creation errors', async () => {
      // Mock: No existing user
      mockGetUserByEmail.mockResolvedValue(null);

      // Mock: User creation fails
      const firebaseError = new Error('Firebase error: email already exists');
      mockCreateUser.mockRejectedValue(firebaseError);

      // Execute
      await bootstrap(req, res, next);

      // Assertions
      expect(mockGetUserByEmail).toHaveBeenCalled();
      expect(mockCreateUser).toHaveBeenCalled();
      expect(mockSetCustomClaims).not.toHaveBeenCalled();
      
      expect(next).toHaveBeenCalledWith(firebaseError);
      expect(mockLoggerError).toHaveBeenCalled();
    });

    test('should handle custom claims setting errors', async () => {
      // Mock: No existing user
      mockGetUserByEmail.mockResolvedValue(null);

      // Mock: User creation succeeds
      const mockUserRecord = {
        uid: 'test-uid-789',
        email: 'nksuhail13@gmail.com'
      };
      mockCreateUser.mockResolvedValue(mockUserRecord);

      // Mock: Set custom claims fails
      const claimsError = new Error('Failed to set custom claims');
      mockSetCustomClaims.mockRejectedValue(claimsError);

      // Execute
      await bootstrap(req, res, next);

      // Assertions
      expect(mockCreateUser).toHaveBeenCalled();
      expect(mockSetCustomClaims).toHaveBeenCalled();
      
      expect(next).toHaveBeenCalledWith(claimsError);
      expect(mockLoggerError).toHaveBeenCalled();
    });
  });

  describe('Logging', () => {
    test('should log bootstrap attempt', async () => {
      // Mock: No existing user
      mockGetUserByEmail.mockResolvedValue(null);
      mockCreateUser.mockResolvedValue({ uid: 'uid', email: 'nksuhail13@gmail.com' });
      mockSetCustomClaims.mockResolvedValue();

      // Execute
      await bootstrap(req, res, next);

      // Assertions
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        'Bootstrap attempt initiated',
        expect.objectContaining({
          timestamp: expect.any(String),
          requestId: 'test-request-id'
        })
      );
    });

    test('should log successful bootstrap completion', async () => {
      // Mock: No existing user
      mockGetUserByEmail.mockResolvedValue(null);
      mockCreateUser.mockResolvedValue({ uid: 'uid-success', email: 'nksuhail13@gmail.com' });
      mockSetCustomClaims.mockResolvedValue();

      // Execute
      await bootstrap(req, res, next);

      // Assertions
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        'Bootstrap completed successfully',
        expect.objectContaining({
          userId: 'uid-success',
          email: 'nksuhail13@gmail.com',
          role: 'systemAdmin',
          timestamp: expect.any(String),
          requestId: 'test-request-id'
        })
      );
    });

    test('should log bootstrap failure', async () => {
      // Mock: Error during user creation
      mockGetUserByEmail.mockResolvedValue(null);
      const error = new Error('Test error');
      mockCreateUser.mockRejectedValue(error);

      // Execute
      await bootstrap(req, res, next);

      // Assertions
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Bootstrap failed',
        expect.objectContaining({
          error: 'Test error',
          timestamp: expect.any(String),
          requestId: 'test-request-id'
        })
      );
    });
  });
});
