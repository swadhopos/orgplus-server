/**
 * Authorization Middleware for OrgPlus Multi-Tenant System
 * 
 * This middleware enforces role-based access control (RBAC) by checking
 * user roles and organization access permissions from custom claims.
 */

const { AuthorizationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Middleware factory to require specific roles
 * 
 * Creates a middleware function that checks if the authenticated user
 * has one of the specified roles. Must be used after authenticateToken middleware.
 * 
 * @param {...string} roles - One or more role names to allow (e.g., 'systemAdmin', 'admin', 'orgMember')
 * @returns {Function} Express middleware function
 * 
 * @example
 * // Allow only system admins
 * router.post('/organizations', requireRole('systemAdmin'), createOrganization);
 * 
 * @example
 * // Allow system admins and organization admins
 * router.get('/households', requireRole('systemAdmin', 'admin'), listHouseholds);
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        throw new AuthorizationError('User not authenticated');
      }

      // Check if user has a role
      if (!req.user.role) {
        logger.warn('User has no role assigned', {
          uid: req.user.uid,
          email: req.user.email,
          requestId: req.id
        });
        throw new AuthorizationError('User has no role assigned');
      }

      // Check if user's role is in the allowed roles
      if (!roles.includes(req.user.role)) {
        logger.warn('User role not authorized for this resource', {
          uid: req.user.uid,
          email: req.user.email,
          userRole: req.user.role,
          requiredRoles: roles,
          requestId: req.id
        });
        throw new AuthorizationError(`Access denied. Required role: ${roles.join(' or ')}`);
      }

      // Log successful authorization
      logger.debug('User role authorized', {
        uid: req.user.uid,
        role: req.user.role,
        requestId: req.id
      });

      next();
    } catch (error) {
      // If it's already an AuthorizationError, pass it through
      if (error instanceof AuthorizationError) {
        return next(error);
      }

      // Log unexpected errors
      logger.error('Unexpected error during role authorization', {
        error: error.message,
        stack: error.stack,
        requestId: req.id
      });

      // Return generic authorization error for unexpected errors
      next(new AuthorizationError('Authorization failed'));
    }
  };
};

/**
 * Middleware to verify organization access
 * 
 * Ensures that non-systemAdmin users can only access resources from their
 * assigned organization. Checks that req.params.orgId matches req.user.orgId.
 * System admins bypass this check and can access all organizations.
 * 
 * Must be used after authenticateToken middleware.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * 
 * @throws {AuthorizationError} When user tries to access a different organization
 * 
 * @example
 * router.get('/organizations/:orgId/households', 
 *   authenticateToken, 
 *   requireOrgAccess, 
 *   listHouseholds
 * );
 */
const requireOrgAccess = (req, res, next) => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      throw new AuthorizationError('User not authenticated');
    }

    // System admins can access all organizations
    if (req.user.role === 'systemAdmin') {
      logger.debug('System admin accessing organization', {
        uid: req.user.uid,
        orgId: req.params.orgId,
        requestId: req.id
      });
      return next();
    }

    // Extract organization ID from request params
    const requestedOrgId = req.params.orgId;

    // Check if orgId is present in params
    if (!requestedOrgId) {
      logger.warn('Organization ID missing from request params', {
        uid: req.user.uid,
        path: req.path,
        requestId: req.id
      });
      throw new AuthorizationError('Organization ID is required');
    }

    // Check if user has an assigned organization
    if (!req.user.orgId) {
      logger.warn('User has no organization assigned', {
        uid: req.user.uid,
        email: req.user.email,
        role: req.user.role,
        requestId: req.id
      });
      throw new AuthorizationError('User has no organization assigned');
    }

    // Verify that requested organization matches user's organization
    if (requestedOrgId !== req.user.orgId) {
      logger.warn('User attempting to access different organization', {
        uid: req.user.uid,
        email: req.user.email,
        userOrgId: req.user.orgId,
        requestedOrgId: requestedOrgId,
        requestId: req.id
      });
      throw new AuthorizationError('Access denied. You can only access your assigned organization');
    }

    // Log successful authorization
    logger.debug('Organization access authorized', {
      uid: req.user.uid,
      orgId: requestedOrgId,
      requestId: req.id
    });

    next();
  } catch (error) {
    // If it's already an AuthorizationError, pass it through
    if (error instanceof AuthorizationError) {
      return next(error);
    }

    // Log unexpected errors
    logger.error('Unexpected error during organization access check', {
      error: error.message,
      stack: error.stack,
      requestId: req.id
    });

    // Return generic authorization error for unexpected errors
    next(new AuthorizationError('Authorization failed'));
  }
};

module.exports = {
  requireRole,
  requireOrgAccess
};
