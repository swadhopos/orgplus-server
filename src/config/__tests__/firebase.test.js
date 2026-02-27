/**
 * Unit tests for Firebase Admin SDK configuration
 */

import { jest } from '@jest/globals';

// Mock firebase-admin before importing
const mockAuth = {
  verifyIdToken: jest.fn(),
  setCustomUserClaims: jest.fn(),
  createUser: jest.fn(),
  getUserByEmail: jest.fn(),
  getUser: jest.fn()
};

const mockApp = {
  options: {
    projectId: 'test-project-id',
    credential: {}
  }
};

const mockAdmin = {
  apps: [],
  app: jest.fn(() => mockApp),
  initializeApp: jest.fn(() => mockApp),
  auth: jest.fn(() => mockAuth),
  credential: {
    cert: jest.fn((serviceAccount) => ({ serviceAccount }))
  }
};

jest.unstable_mockModule('firebase-admin', () => ({
  default: mockAdmin
}));

// Import after mocking
const { 
  getFirebaseAdmin, 
  getAuth, 
  verifyIdToken,
  setCustomClaims,
  createUser,
  getUserByEmail,
  getUserByUid
} = await import('../firebase.js');

describe('Firebase Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getFirebaseAdmin', () => {
    it('should return Firebase Admin app instance', () => {
      const app = getFirebaseAdmin();
      expect(app).toBeDefined();
      expect(app.options.projectId).toBe('test-project-id');
    });
  });

  describe('getAuth', () => {
    it('should return Firebase Auth instance', () => {
      const auth = getAuth();
      expect(auth).toBeDefined();
      expect(mockAdmin.auth).toHaveBeenCalled();
    });
  });

  describe('verifyIdToken', () => {
    it('should verify a valid token', async () => {
      const mockToken = 'valid-token';
      const mockDecodedToken = {
        uid: 'user123',
        email: 'test@example.com',
        role: 'admin'
      };
      
      mockAuth.verifyIdToken.mockResolvedValue(mockDecodedToken);
      
      const result = await verifyIdToken(mockToken);
      
      expect(result).toEqual(mockDecodedToken);
      expect(mockAuth.verifyIdToken).toHaveBeenCalledWith(mockToken);
    });

    it('should throw error for invalid token', async () => {
      const mockToken = 'invalid-token';
      mockAuth.verifyIdToken.mockRejectedValue(new Error('Invalid token'));
      
      await expect(verifyIdToken(mockToken)).rejects.toThrow('Token verification failed');
    });
  });

  describe('setCustomClaims', () => {
    it('should set custom claims for a user', async () => {
      const uid = 'user123';
      const claims = { role: 'admin', orgId: 'org456' };
      
      mockAuth.setCustomUserClaims.mockResolvedValue();
      
      await setCustomClaims(uid, claims);
      
      expect(mockAuth.setCustomUserClaims).toHaveBeenCalledWith(uid, claims);
    });

    it('should throw error if setting claims fails', async () => {
      const uid = 'user123';
      const claims = { role: 'admin' };
      
      mockAuth.setCustomUserClaims.mockRejectedValue(new Error('Permission denied'));
      
      await expect(setCustomClaims(uid, claims)).rejects.toThrow('Failed to set custom claims');
    });
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const email = 'newuser@example.com';
      const password = 'password123';
      const mockUserRecord = {
        uid: 'newuser123',
        email: email
      };
      
      mockAuth.createUser.mockResolvedValue(mockUserRecord);
      
      const result = await createUser(email, password);
      
      expect(result).toEqual(mockUserRecord);
      expect(mockAuth.createUser).toHaveBeenCalledWith({
        email,
        password,
        emailVerified: false
      });
    });

    it('should throw error if user creation fails', async () => {
      const email = 'existing@example.com';
      const password = 'password123';
      
      mockAuth.createUser.mockRejectedValue(new Error('Email already exists'));
      
      await expect(createUser(email, password)).rejects.toThrow('Failed to create user');
    });
  });

  describe('getUserByEmail', () => {
    it('should return user record for existing email', async () => {
      const email = 'test@example.com';
      const mockUserRecord = {
        uid: 'user123',
        email: email
      };
      
      mockAuth.getUserByEmail.mockResolvedValue(mockUserRecord);
      
      const result = await getUserByEmail(email);
      
      expect(result).toEqual(mockUserRecord);
      expect(mockAuth.getUserByEmail).toHaveBeenCalledWith(email);
    });

    it('should return null for non-existent email', async () => {
      const email = 'nonexistent@example.com';
      const error = new Error('User not found');
      error.code = 'auth/user-not-found';
      
      mockAuth.getUserByEmail.mockRejectedValue(error);
      
      const result = await getUserByEmail(email);
      
      expect(result).toBeNull();
    });

    it('should throw error for other failures', async () => {
      const email = 'test@example.com';
      
      mockAuth.getUserByEmail.mockRejectedValue(new Error('Network error'));
      
      await expect(getUserByEmail(email)).rejects.toThrow('Failed to get user by email');
    });
  });

  describe('getUserByUid', () => {
    it('should return user record for existing UID', async () => {
      const uid = 'user123';
      const mockUserRecord = {
        uid: uid,
        email: 'test@example.com'
      };
      
      mockAuth.getUser.mockResolvedValue(mockUserRecord);
      
      const result = await getUserByUid(uid);
      
      expect(result).toEqual(mockUserRecord);
      expect(mockAuth.getUser).toHaveBeenCalledWith(uid);
    });

    it('should return null for non-existent UID', async () => {
      const uid = 'nonexistent';
      const error = new Error('User not found');
      error.code = 'auth/user-not-found';
      
      mockAuth.getUser.mockRejectedValue(error);
      
      const result = await getUserByUid(uid);
      
      expect(result).toBeNull();
    });

    it('should throw error for other failures', async () => {
      const uid = 'user123';
      
      mockAuth.getUser.mockRejectedValue(new Error('Network error'));
      
      await expect(getUserByUid(uid)).rejects.toThrow('Failed to get user by UID');
    });
  });
});
