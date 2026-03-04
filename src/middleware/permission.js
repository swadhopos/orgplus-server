/**
 * Permission Middleware for OrgPlus Multi-Tenant System
 * 
 * This middleware enforces custom permissions for staff users,
 * allowing fine-grained access control beyond basic roles.
 */

const { AuthorizationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Middleware factory to require a specific permission
 * 
 * Creates a middleware function that checks if the authenticated user
 * has the required permission in their custom claims.
 * Admins implicitly bypass this check.
 * 
 * @param {string} permissionKey - The name of the permission to require (e.g., 'canManageMembers')
 * @returns {Function} Express middleware function
 */
const requirePermission = (permissionKey) => {
    return (req, res, next) => {
        try {
            // Ensure user is authenticated
            if (!req.user) {
                throw new AuthorizationError('User not authenticated');
            }

            // Check for Admin roles (systemAdmin, admin bypass permission checks)
            if (req.user.role === 'systemAdmin' || req.user.role === 'admin') {
                logger.debug('Admin user bypassing permission check', {
                    uid: req.user.uid,
                    role: req.user.role,
                    permissionRequired: permissionKey,
                    requestId: req.id
                });
                return next();
            }

            // If user is 'staff', verify their permissions array
            if (req.user.role === 'staff') {
                const userPermissions = req.user.permissions || [];

                if (!userPermissions.includes(permissionKey)) {
                    logger.warn('Staff user lacking required permission', {
                        uid: req.user.uid,
                        email: req.user.email,
                        permissionRequired: permissionKey,
                        userPermissions: userPermissions,
                        requestId: req.id
                    });
                    throw new AuthorizationError(`Access denied. Missing permission: ${permissionKey}`);
                }

                // Log successful authorization for staff
                logger.debug('Staff permission authorized', {
                    uid: req.user.uid,
                    permissionRequired: permissionKey,
                    requestId: req.id
                });
                return next();
            }

            // If they are not admin or staff (e.g., just an orgMember), deny complex actions
            logger.warn('User lacking role capable of having permissions', {
                uid: req.user.uid,
                userRole: req.user.role,
                permissionRequired: permissionKey,
                requestId: req.id
            });
            throw new AuthorizationError(`Access denied. You do not have permission to perform this action.`);

        } catch (error) {
            if (error instanceof AuthorizationError) {
                return next(error);
            }
            logger.error('Unexpected error during permission check', {
                error: error.message,
                stack: error.stack,
                requestId: req.id
            });
            next(new AuthorizationError('Permission check failed'));
        }
    };
};

module.exports = {
    requirePermission
};
