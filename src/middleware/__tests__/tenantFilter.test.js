/**
 * Unit Tests for Tenant Filter Middleware
 * 
 * Tests automatic tenant filtering based on user roles.
 */

import { applyTenantFilter } from '../tenantFilter.js';

describe('Tenant Filter Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    // Mock request object
    req = {
      id: 'test-request-id',
      path: '/api/test',
      headers: {},
      params: {},
      user: null,
      tenantFilter: null
    };

    // Mock response object
    res = {};

    // Mock next function
    next = (err) => {
      next.called = true;
      next.error = err;
    };
  });

  describe('unauthenticated requests', () => {
    it('should set empty filter when user is not authenticated', () => {
      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({});
    });

    it('should set empty filter when user is null', () => {
      req.user = null;
      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({});
    });

    it('should set empty filter when user is undefined', () => {
      req.user = undefined;
      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({});
    });
  });

  describe('systemAdmin role', () => {
    it('should set empty filter for systemAdmin users', () => {
      req.user = {
        uid: 'admin123',
        email: 'sysadmin@example.com',
        role: 'systemAdmin'
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({});
    });

    it('should set empty filter for systemAdmin even with orgId present', () => {
      req.user = {
        uid: 'admin123',
        email: 'sysadmin@example.com',
        role: 'systemAdmin',
        orgId: 'org123'
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({});
    });

    it('should set empty filter for systemAdmin with householdId present', () => {
      req.user = {
        uid: 'admin123',
        email: 'sysadmin@example.com',
        role: 'systemAdmin',
        orgId: 'org123',
        householdId: 'house123'
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({});
    });
  });

  describe('admin role', () => {
    it('should filter by organizationId for admin users', () => {
      req.user = {
        uid: 'user123',
        email: 'admin@example.com',
        role: 'admin',
        orgId: 'org123'
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({
        organizationId: 'org123'
      });
    });

    it('should set empty filter when admin has no orgId', () => {
      req.user = {
        uid: 'user123',
        email: 'admin@example.com',
        role: 'admin',
        orgId: null
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({});
    });

    it('should set empty filter when admin has undefined orgId', () => {
      req.user = {
        uid: 'user123',
        email: 'admin@example.com',
        role: 'admin',
        orgId: undefined
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({});
    });

    it('should set empty filter when admin has empty string orgId', () => {
      req.user = {
        uid: 'user123',
        email: 'admin@example.com',
        role: 'admin',
        orgId: ''
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({});
    });

    it('should ignore householdId for admin users', () => {
      req.user = {
        uid: 'user123',
        email: 'admin@example.com',
        role: 'admin',
        orgId: 'org123',
        householdId: 'house123'
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({
        organizationId: 'org123'
      });
      expect(req.tenantFilter.householdId).toBeUndefined();
    });

    it('should handle MongoDB ObjectId format for orgId', () => {
      const objectId = '507f1f77bcf86cd799439011';
      req.user = {
        uid: 'user123',
        email: 'admin@example.com',
        role: 'admin',
        orgId: objectId
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({
        organizationId: objectId
      });
    });
  });

  describe('orgMember role', () => {
    it('should filter by organizationId and householdId for orgMember users', () => {
      req.user = {
        uid: 'user123',
        email: 'member@example.com',
        role: 'orgMember',
        orgId: 'org123',
        householdId: 'house123'
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({
        organizationId: 'org123',
        householdId: 'house123'
      });
    });

    it('should set empty filter when orgMember has no orgId', () => {
      req.user = {
        uid: 'user123',
        email: 'member@example.com',
        role: 'orgMember',
        orgId: null,
        householdId: 'house123'
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({});
    });

    it('should set empty filter when orgMember has no householdId', () => {
      req.user = {
        uid: 'user123',
        email: 'member@example.com',
        role: 'orgMember',
        orgId: 'org123',
        householdId: null
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({});
    });

    it('should set empty filter when orgMember has no orgId and no householdId', () => {
      req.user = {
        uid: 'user123',
        email: 'member@example.com',
        role: 'orgMember',
        orgId: null,
        householdId: null
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({});
    });

    it('should set empty filter when orgMember has undefined orgId', () => {
      req.user = {
        uid: 'user123',
        email: 'member@example.com',
        role: 'orgMember',
        orgId: undefined,
        householdId: 'house123'
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({});
    });

    it('should set empty filter when orgMember has undefined householdId', () => {
      req.user = {
        uid: 'user123',
        email: 'member@example.com',
        role: 'orgMember',
        orgId: 'org123',
        householdId: undefined
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({});
    });

    it('should set empty filter when orgMember has empty string orgId', () => {
      req.user = {
        uid: 'user123',
        email: 'member@example.com',
        role: 'orgMember',
        orgId: '',
        householdId: 'house123'
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({});
    });

    it('should set empty filter when orgMember has empty string householdId', () => {
      req.user = {
        uid: 'user123',
        email: 'member@example.com',
        role: 'orgMember',
        orgId: 'org123',
        householdId: ''
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({});
    });

    it('should handle MongoDB ObjectId format for orgId and householdId', () => {
      const orgObjectId = '507f1f77bcf86cd799439011';
      const houseObjectId = '507f1f77bcf86cd799439012';
      req.user = {
        uid: 'user123',
        email: 'member@example.com',
        role: 'orgMember',
        orgId: orgObjectId,
        householdId: houseObjectId
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({
        organizationId: orgObjectId,
        householdId: houseObjectId
      });
    });
  });

  describe('unknown roles', () => {
    it('should set empty filter for unknown role', () => {
      req.user = {
        uid: 'user123',
        email: 'test@example.com',
        role: 'unknownRole',
        orgId: 'org123'
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({});
    });

    it('should set empty filter when role is null', () => {
      req.user = {
        uid: 'user123',
        email: 'test@example.com',
        role: null,
        orgId: 'org123'
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({});
    });

    it('should set empty filter when role is undefined', () => {
      req.user = {
        uid: 'user123',
        email: 'test@example.com',
        role: undefined,
        orgId: 'org123'
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({});
    });

    it('should set empty filter when role is empty string', () => {
      req.user = {
        uid: 'user123',
        email: 'test@example.com',
        role: '',
        orgId: 'org123'
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({});
    });
  });

  describe('role case sensitivity', () => {
    it('should be case-sensitive for systemAdmin role', () => {
      req.user = {
        uid: 'admin123',
        email: 'sysadmin@example.com',
        role: 'SystemAdmin'
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({});
    });

    it('should be case-sensitive for admin role', () => {
      req.user = {
        uid: 'user123',
        email: 'admin@example.com',
        role: 'Admin',
        orgId: 'org123'
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({});
    });

    it('should be case-sensitive for orgMember role', () => {
      req.user = {
        uid: 'user123',
        email: 'member@example.com',
        role: 'OrgMember',
        orgId: 'org123',
        householdId: 'house123'
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({});
    });
  });

  describe('filter object properties', () => {
    it('should create a new filter object for each request', () => {
      req.user = {
        uid: 'user123',
        email: 'admin@example.com',
        role: 'admin',
        orgId: 'org123'
      };

      applyTenantFilter(req, res, next);
      const firstFilter = req.tenantFilter;

      // Create new request
      req = {
        id: 'test-request-id-2',
        path: '/api/test',
        user: {
          uid: 'user456',
          email: 'admin2@example.com',
          role: 'admin',
          orgId: 'org456'
        },
        tenantFilter: null
      };
      next = (err) => {
        next.called = true;
        next.error = err;
      };

      applyTenantFilter(req, res, next);
      const secondFilter = req.tenantFilter;

      expect(firstFilter).not.toBe(secondFilter);
      expect(firstFilter.organizationId).toBe('org123');
      expect(secondFilter.organizationId).toBe('org456');
    });

    it('should not modify the user object', () => {
      req.user = {
        uid: 'user123',
        email: 'admin@example.com',
        role: 'admin',
        orgId: 'org123'
      };

      const userBefore = { ...req.user };
      applyTenantFilter(req, res, next);

      expect(req.user).toEqual(userBefore);
    });
  });

  describe('error handling', () => {
    it('should set empty filter on unexpected error', () => {
      // Create a user object that throws an error when accessing role
      req.user = {};
      Object.defineProperty(req.user, 'role', {
        get() {
          throw new Error('Unexpected error');
        }
      });

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({});
    });

    it('should continue to next middleware even on error', () => {
      req.user = {};
      Object.defineProperty(req.user, 'role', {
        get() {
          throw new Error('Unexpected error');
        }
      });

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
    });
  });

  describe('middleware integration', () => {
    it('should work correctly after authenticateToken middleware', () => {
      req.user = {
        uid: 'user123',
        email: 'admin@example.com',
        role: 'admin',
        orgId: 'org123'
      };

      applyTenantFilter(req, res, next);

      expect(next.called).toBe(true);
      expect(next.error).toBeUndefined();
      expect(req.tenantFilter).toEqual({
        organizationId: 'org123'
      });
    });

    it('should allow filter to be used in database queries', () => {
      req.user = {
        uid: 'user123',
        email: 'admin@example.com',
        role: 'admin',
        orgId: 'org123'
      };

      applyTenantFilter(req, res, next);

      // Simulate using the filter in a query
      const query = {
        ...req.tenantFilter,
        isDeleted: false,
        status: 'active'
      };

      expect(query).toEqual({
        organizationId: 'org123',
        isDeleted: false,
        status: 'active'
      });
    });

    it('should allow empty filter for systemAdmin to query all data', () => {
      req.user = {
        uid: 'admin123',
        email: 'sysadmin@example.com',
        role: 'systemAdmin'
      };

      applyTenantFilter(req, res, next);

      // Simulate using the filter in a query
      const query = {
        ...req.tenantFilter,
        isDeleted: false
      };

      expect(query).toEqual({
        isDeleted: false
      });
      expect(query.organizationId).toBeUndefined();
    });
  });

  describe('multiple role scenarios', () => {
    it('should handle different users with different roles in sequence', () => {
      // First request: systemAdmin
      req.user = {
        uid: 'admin123',
        email: 'sysadmin@example.com',
        role: 'systemAdmin'
      };
      applyTenantFilter(req, res, next);
      expect(req.tenantFilter).toEqual({});

      // Second request: admin
      req = {
        id: 'test-request-id-2',
        path: '/api/test',
        user: {
          uid: 'user123',
          email: 'admin@example.com',
          role: 'admin',
          orgId: 'org123'
        },
        tenantFilter: null
      };
      next = (err) => {
        next.called = true;
        next.error = err;
      };
      applyTenantFilter(req, res, next);
      expect(req.tenantFilter).toEqual({ organizationId: 'org123' });

      // Third request: orgMember
      req = {
        id: 'test-request-id-3',
        path: '/api/test',
        user: {
          uid: 'user456',
          email: 'member@example.com',
          role: 'orgMember',
          orgId: 'org123',
          householdId: 'house123'
        },
        tenantFilter: null
      };
      next = (err) => {
        next.called = true;
        next.error = err;
      };
      applyTenantFilter(req, res, next);
      expect(req.tenantFilter).toEqual({
        organizationId: 'org123',
        householdId: 'house123'
      });
    });
  });
});
