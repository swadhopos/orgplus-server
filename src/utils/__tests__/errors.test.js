/**
 * Unit Tests for Custom Error Classes
 */

import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  InternalError
} from '../errors.js';

describe('Custom Error Classes', () => {
  describe('AppError', () => {
    it('should create an AppError with all properties', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR', { field: 'test' });
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.details).toEqual({ field: 'test' });
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe('AppError');
      expect(error.stack).toBeDefined();
    });

    it('should create an AppError without details', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR');
      
      expect(error.details).toBeNull();
    });

    it('should capture stack trace', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR');
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });
  });

  describe('ValidationError', () => {
    it('should create a ValidationError with default message', () => {
      const error = new ValidationError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toBeNull();
      expect(error.isOperational).toBe(true);
    });

    it('should create a ValidationError with custom message and details', () => {
      const details = [
        { field: 'email', message: 'Email is required' },
        { field: 'name', message: 'Name must be at least 3 characters' }
      ];
      const error = new ValidationError('Invalid input', details);
      
      expect(error.message).toBe('Invalid input');
      expect(error.details).toEqual(details);
    });
  });

  describe('AuthenticationError', () => {
    it('should create an AuthenticationError with default message', () => {
      const error = new AuthenticationError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Authentication failed');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should create an AuthenticationError with custom message', () => {
      const error = new AuthenticationError('Invalid token');
      
      expect(error.message).toBe('Invalid token');
    });
  });

  describe('AuthorizationError', () => {
    it('should create an AuthorizationError with default message', () => {
      const error = new AuthorizationError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Access denied');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('AUTHORIZATION_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should create an AuthorizationError with custom message and details', () => {
      const error = new AuthorizationError('Insufficient permissions', { required: 'admin' });
      
      expect(error.message).toBe('Insufficient permissions');
      expect(error.details).toEqual({ required: 'admin' });
    });
  });

  describe('NotFoundError', () => {
    it('should create a NotFoundError with default message', () => {
      const error = new NotFoundError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.isOperational).toBe(true);
    });

    it('should create a NotFoundError with custom message', () => {
      const error = new NotFoundError('Organization not found');
      
      expect(error.message).toBe('Organization not found');
    });
  });

  describe('ConflictError', () => {
    it('should create a ConflictError with default message', () => {
      const error = new ConflictError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Resource conflict');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should create a ConflictError with custom message and details', () => {
      const error = new ConflictError('Organization name already exists', { field: 'name' });
      
      expect(error.message).toBe('Organization name already exists');
      expect(error.details).toEqual({ field: 'name' });
    });
  });

  describe('InternalError', () => {
    it('should create an InternalError with default message', () => {
      const error = new InternalError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Internal server error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should create an InternalError with custom message', () => {
      const error = new InternalError('Database connection failed');
      
      expect(error.message).toBe('Database connection failed');
    });
  });

  describe('Error inheritance', () => {
    it('should allow instanceof checks for Error', () => {
      const errors = [
        new ValidationError(),
        new AuthenticationError(),
        new AuthorizationError(),
        new NotFoundError(),
        new ConflictError(),
        new InternalError()
      ];
      
      errors.forEach(error => {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(AppError);
      });
    });

    it('should have correct error names', () => {
      expect(new ValidationError().name).toBe('ValidationError');
      expect(new AuthenticationError().name).toBe('AuthenticationError');
      expect(new AuthorizationError().name).toBe('AuthorizationError');
      expect(new NotFoundError().name).toBe('NotFoundError');
      expect(new ConflictError().name).toBe('ConflictError');
      expect(new InternalError().name).toBe('InternalError');
    });
  });
});
