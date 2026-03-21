/**
 * Tenant Filter Middleware for OrgPlus Multi-Tenant System
 * 
 * This middleware automatically applies tenant isolation filters based on user role.
 * It ensures that users can only access data from their assigned organization and,
 * for orgMember users, their assigned household.
 */

const logger = require('../utils/logger');

/**
 * Middleware to apply tenant filtering based on user role
 * 
 * Automatically creates a filter object that should be applied to database queries
 * to enforce multi-tenant data isolation. The filter is attached to req.tenantFilter
 * for use in controllers and database queries.
 * 
 * Filter behavior by role:
 * - systemAdmin: No filter (can access all data)
 * - admin: Filter by organizationId only
 * - orgMember: Filter by organizationId AND householdId (for future household member app API)
 * 
 * Must be used after authenticateToken middleware.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * 
 * @example
 * // In a route
 * router.get('/households', 
 *   authenticateToken, 
 *   applyTenantFilter, 
 *   listHouseholds
 * );
 * 
 * // In a controller
 * const households = await Household.find({ 
 *   ...req.tenantFilter,
 *   isDeleted: false 
 * });
 */
const applyTenantFilter = (req, res, next) => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      logger.warn('Tenant filter applied without authenticated user', {
        path: req.path,
        requestId: req.id
      });
      // Initialize empty filter for unauthenticated requests
      req.tenantFilter = {};
      return next();
    }

    // Initialize tenant filter object
    req.tenantFilter = {};

    // System admins can access all data - no filter needed
    if (req.user.role === 'systemAdmin') {
      logger.debug('System admin - no tenant filter applied', {
        uid: req.user.uid,
        requestId: req.id
      });
      return next();
    }

    // Admin users: filter by organizationId only
    if (req.user.role === 'admin') {
      if (!req.user.orgId) {
        logger.warn('Admin user has no organization assigned', {
          uid: req.user.uid,
          email: req.user.email,
          requestId: req.id
        });
        // Set empty filter - will result in no data being returned
        req.tenantFilter = {};
        return next();
      }

      req.tenantFilter = {
        organizationId: req.user.orgId
      };

      logger.debug('Admin tenant filter applied', {
        uid: req.user.uid,
        orgId: req.user.orgId,
        requestId: req.id
      });

      return next();
    }

    // OrgMember users: filter by organizationId AND householdId
    // Note: This is for future household member application API endpoints
    if (req.user.role === 'orgMember') {
      if (!req.user.orgId || !req.user.householdId) {
        logger.warn('OrgMember user missing organization or household assignment', {
          uid: req.user.uid,
          email: req.user.email,
          orgId: req.user.orgId,
          householdId: req.user.householdId,
          requestId: req.id
        });
        // Set empty filter - will result in no data being returned
        req.tenantFilter = {};
        return next();
      }

      req.tenantFilter = {
        organizationId: req.user.orgId,
        householdId: req.user.householdId
      };

      logger.debug('OrgMember tenant filter applied', {
        uid: req.user.uid,
        orgId: req.user.orgId,
        householdId: req.user.householdId,
        requestId: req.id
      });

      return next();
    }

    // Unknown role - apply a non-matching filter to prevent data leakage (fail-safe)
    logger.warn('Unknown user role - applying non-matching tenant filter', {
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role,
      requestId: req.id
    });

    req.tenantFilter = { _id: null }; // Matches nothing, prevents wildcard bypass
    next();
  } catch (error) {
    // Log unexpected errors
    logger.error('Unexpected error during tenant filter application', {
      error: error.message,
      stack: error.stack,
      requestId: req.id
    });

    // Set empty filter on error to prevent data leakage
    req.tenantFilter = {};
    next();
  }
};

module.exports = {
  applyTenantFilter
};
