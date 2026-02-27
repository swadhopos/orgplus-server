/**
 * Unit Tests for Authorization Middleware
 * 
 * Tests role-based access control and organization access verification.
 */

import { requireRole, requireOrgAccess } from '../authorize.js';
import { AuthorizationError } from '../../utils/errors.js';

describe('Authorization Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    // Mock request object
    req = {
      id: 'test-request-id',
      headers: {},
      params: {},
      user: null
    };

    // Mock response object
    res = {};

    // Mock next function
    next = (err) => {
      next.called = true;
      next.error = err;
    };
  });

  describe('requireRole', () => {
    describe('authentication checks', () => {
      it('should return 403 when user is not authenticated', () => {
        const middleware = requireRole('admin');
        middleware(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeInstanceOf(AuthorizationError);
        expect(next.error.message).toBe('User not authenticated');
        expect(next.error.statusCode).toBe(403);
      });

      it('should return 403 when user has no role assigned', () => {
        req.user = {
          uid: 'user123',
          email: 'test@example.com',
          role: null
        };

        const middleware = requireRole('admin');
        middleware(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeInstanceOf(AuthorizationError);
        expect(next.error.message).toBe('User has no role assigned');
        expect(next.error.statusCode).toBe(403);
      });
    });

    describe('single role requirement', () => {
      it('should allow access when user has the required role', () => {
        req.user = {
          uid: 'user123',
          email: 'admin@example.com',
          role: 'admin',
          orgId: 'org123'
        };

        const middleware = requireRole('admin');
        middleware(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeUndefined();
      });

      it('should deny access when user does not have the required role', () => {
        req.user = {
          uid: 'user123',
          email: 'member@example.com',
          role: 'orgMember',
          orgId: 'org123'
        };

        const middleware = requireRole('admin');
        middleware(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeInstanceOf(AuthorizationError);
        expect(next.error.message).toContain('Access denied');
        expect(next.error.message).toContain('admin');
        expect(next.error.statusCode).toBe(403);
      });

      it('should allow systemAdmin role', () => {
        req.user = {
          uid: 'admin123',
          email: 'sysadmin@example.com',
          role: 'systemAdmin'
        };

        const middleware = requireRole('systemAdmin');
        middleware(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeUndefined();
      });
    });

    describe('multiple role requirements', () => {
      it('should allow access when user has one of the required roles (first role)', () => {
        req.user = {
          uid: 'admin123',
          email: 'sysadmin@example.com',
          role: 'systemAdmin'
        };

        const middleware = requireRole('systemAdmin', 'admin');
        middleware(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeUndefined();
      });

      it('should allow access when user has one of the required roles (second role)', () => {
        req.user = {
          uid: 'user123',
          email: 'admin@example.com',
          role: 'admin',
          orgId: 'org123'
        };

        const middleware = requireRole('systemAdmin', 'admin');
        middleware(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeUndefined();
      });

      it('should deny access when user does not have any of the required roles', () => {
        req.user = {
          uid: 'user123',
          email: 'member@example.com',
          role: 'orgMember',
          orgId: 'org123'
        };

        const middleware = requireRole('systemAdmin', 'admin');
        middleware(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeInstanceOf(AuthorizationError);
        expect(next.error.message).toContain('Access denied');
        expect(next.error.statusCode).toBe(403);
      });

      it('should allow access with three role options', () => {
        req.user = {
          uid: 'user123',
          email: 'member@example.com',
          role: 'orgMember',
          orgId: 'org123',
          householdId: 'house123'
        };

        const middleware = requireRole('systemAdmin', 'admin', 'orgMember');
        middleware(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeUndefined();
      });
    });

    describe('role validation', () => {
      it('should be case-sensitive for role matching', () => {
        req.user = {
          uid: 'user123',
          email: 'admin@example.com',
          role: 'Admin', // Capital A
          orgId: 'org123'
        };

        const middleware = requireRole('admin'); // lowercase
        middleware(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeInstanceOf(AuthorizationError);
        expect(next.error.message).toContain('Access denied');
      });

      it('should handle empty role string', () => {
        req.user = {
          uid: 'user123',
          email: 'test@example.com',
          role: ''
        };

        const middleware = requireRole('admin');
        middleware(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeInstanceOf(AuthorizationError);
      });
    });

    describe('error handling', () => {
      it('should return AuthorizationError with correct properties', () => {
        req.user = {
          uid: 'user123',
          email: 'member@example.com',
          role: 'orgMember'
        };

        const middleware = requireRole('admin');
        middleware(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeInstanceOf(AuthorizationError);
        expect(next.error.code).toBe('AUTHORIZATION_ERROR');
        expect(next.error.statusCode).toBe(403);
        expect(next.error.isOperational).toBe(true);
      });
    });
  });

  describe('requireOrgAccess', () => {
    describe('authentication checks', () => {
      it('should return 403 when user is not authenticated', () => {
        requireOrgAccess(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeInstanceOf(AuthorizationError);
        expect(next.error.message).toBe('User not authenticated');
        expect(next.error.statusCode).toBe(403);
      });
    });

    describe('systemAdmin access', () => {
      it('should allow systemAdmin to access any organization', () => {
        req.user = {
          uid: 'admin123',
          email: 'sysadmin@example.com',
          role: 'systemAdmin'
        };
        req.params.orgId = 'org123';

        requireOrgAccess(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeUndefined();
      });

      it('should allow systemAdmin even without orgId in user claims', () => {
        req.user = {
          uid: 'admin123',
          email: 'sysadmin@example.com',
          role: 'systemAdmin',
          orgId: null
        };
        req.params.orgId = 'org456';

        requireOrgAccess(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeUndefined();
      });
    });

    describe('organization admin access', () => {
      it('should allow admin to access their own organization', () => {
        req.user = {
          uid: 'user123',
          email: 'admin@example.com',
          role: 'admin',
          orgId: 'org123'
        };
        req.params.orgId = 'org123';

        requireOrgAccess(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeUndefined();
      });

      it('should deny admin access to different organization', () => {
        req.user = {
          uid: 'user123',
          email: 'admin@example.com',
          role: 'admin',
          orgId: 'org123'
        };
        req.params.orgId = 'org456'; // Different organization

        requireOrgAccess(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeInstanceOf(AuthorizationError);
        expect(next.error.message).toContain('Access denied');
        expect(next.error.message).toContain('assigned organization');
        expect(next.error.statusCode).toBe(403);
      });

      it('should return 403 when admin has no orgId assigned', () => {
        req.user = {
          uid: 'user123',
          email: 'admin@example.com',
          role: 'admin',
          orgId: null
        };
        req.params.orgId = 'org123';

        requireOrgAccess(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeInstanceOf(AuthorizationError);
        expect(next.error.message).toBe('User has no organization assigned');
        expect(next.error.statusCode).toBe(403);
      });
    });

    describe('organization member access', () => {
      it('should allow orgMember to access their own organization', () => {
        req.user = {
          uid: 'user123',
          email: 'member@example.com',
          role: 'orgMember',
          orgId: 'org123',
          householdId: 'house123'
        };
        req.params.orgId = 'org123';

        requireOrgAccess(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeUndefined();
      });

      it('should deny orgMember access to different organization', () => {
        req.user = {
          uid: 'user123',
          email: 'member@example.com',
          role: 'orgMember',
          orgId: 'org123',
          householdId: 'house123'
        };
        req.params.orgId = 'org456'; // Different organization

        requireOrgAccess(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeInstanceOf(AuthorizationError);
        expect(next.error.message).toContain('Access denied');
        expect(next.error.statusCode).toBe(403);
      });
    });

    describe('parameter validation', () => {
      it('should return 403 when orgId is missing from params', () => {
        req.user = {
          uid: 'user123',
          email: 'admin@example.com',
          role: 'admin',
          orgId: 'org123'
        };
        req.params.orgId = undefined;

        requireOrgAccess(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeInstanceOf(AuthorizationError);
        expect(next.error.message).toBe('Organization ID is required');
        expect(next.error.statusCode).toBe(403);
      });

      it('should return 403 when orgId is empty string', () => {
        req.user = {
          uid: 'user123',
          email: 'admin@example.com',
          role: 'admin',
          orgId: 'org123'
        };
        req.params.orgId = '';

        requireOrgAccess(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeInstanceOf(AuthorizationError);
        expect(next.error.message).toBe('Organization ID is required');
      });
    });

    describe('organization ID matching', () => {
      it('should be case-sensitive for organization ID matching', () => {
        req.user = {
          uid: 'user123',
          email: 'admin@example.com',
          role: 'admin',
          orgId: 'org123'
        };
        req.params.orgId = 'ORG123'; // Different case

        requireOrgAccess(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeInstanceOf(AuthorizationError);
        expect(next.error.message).toContain('Access denied');
      });

      it('should handle MongoDB ObjectId format', () => {
        const objectId = '507f1f77bcf86cd799439011';
        req.user = {
          uid: 'user123',
          email: 'admin@example.com',
          role: 'admin',
          orgId: objectId
        };
        req.params.orgId = objectId;

        requireOrgAccess(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeUndefined();
      });
    });

    describe('error handling', () => {
      it('should return AuthorizationError with correct properties', () => {
        req.user = {
          uid: 'user123',
          email: 'admin@example.com',
          role: 'admin',
          orgId: 'org123'
        };
        req.params.orgId = 'org456';

        requireOrgAccess(req, res, next);

        expect(next.called).toBe(true);
        expect(next.error).toBeInstanceOf(AuthorizationError);
        expect(next.error.code).toBe('AUTHORIZATION_ERROR');
        expect(next.error.statusCode).toBe(403);
        expect(next.error.isOperational).toBe(true);
      });
    });
  });

  describe('middleware chaining', () => {
    it('should work correctly when requireRole and requireOrgAccess are chained', () => {
      req.user = {
        uid: 'user123',
        email: 'admin@example.com',
        role: 'admin',
        orgId: 'org123'
      };
      req.params.orgId = 'org123';

      // First middleware: requireRole
      const roleMiddleware = requireRole('admin', 'systemAdmin');
      roleMiddleware(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();

      // Reset next
      next.called = false;
      next.error = undefined;

      // Second middleware: requireOrgAccess
      requireOrgAccess(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
    });

    it('should fail at requireRole if user has wrong role', () => {
      req.user = {
        uid: 'user123',
        email: 'member@example.com',
        role: 'orgMember',
        orgId: 'org123'
      };
      req.params.orgId = 'org123';

      // First middleware: requireRole (should fail)
      const roleMiddleware = requireRole('admin', 'systemAdmin');
      roleMiddleware(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeInstanceOf(AuthorizationError);
      expect(next.error.message).toContain('Access denied');
    });

    it('should fail at requireOrgAccess if user tries to access different org', () => {
      req.user = {
        uid: 'user123',
        email: 'admin@example.com',
        role: 'admin',
        orgId: 'org123'
      };
      req.params.orgId = 'org456';

      // First middleware: requireRole (should pass)
      const roleMiddleware = requireRole('admin');
      roleMiddleware(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();

      // Reset next
      next.called = false;
      next.error = undefined;

      // Second middleware: requireOrgAccess (should fail)
      requireOrgAccess(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeInstanceOf(AuthorizationError);
      expect(next.error.message).toContain('Access denied');
    });
  });
});
