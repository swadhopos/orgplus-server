/**
 * Permission Middleware for OrgPlus Multi-Tenant System
 * 
 * This middleware enforces custom permissions for staff users,
 * allowing fine-grained access control beyond basic roles.
 */

const { AuthorizationError } = require('../utils/errors');
const logger = require('../utils/logger');

const Staff = require('../models/Staff');

/**
 * Middleware factory to require a specific permission
 * 
 * Creates a middleware function that checks if the authenticated user
 * has the required permission. 
 * For staff users, it fetches current permissions from MongoDB.
 * Admins implicitly bypass this check.
 * 
 * @param {string} permissionKey - The name of the permission to require (e.g., 'canManageMembers')
 * @returns {Function} Express middleware function
 */
const requirePermission = (permissionKey) => {
    return async (req, res, next) => {
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

            // If user is 'staff', verify their permissions from MongoDB
            if (req.user.role === 'staff') {
                const orgId = req.params.orgId || req.user.orgId;

                if (!orgId) {
                    throw new AuthorizationError('Organization ID context is missing');
                }

                // Fetch staff document from DB
                const staff = await Staff.findOne({ 
                    userId: req.user.uid, 
                    orgId: orgId,
                    isDeleted: false 
                });

                if (!staff) {
                    logger.warn('Staff record not found for authenticated staff user', {
                        uid: req.user.uid,
                        orgId: orgId,
                        requestId: req.id
                    });
                    throw new AuthorizationError('Access denied. Staff record not found.');
                }

                if (staff.status !== 'active') {
                    throw new AuthorizationError(`Access denied. Staff account status is ${staff.status}`);
                }

                const userPermissions = staff.permissions || [];

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

                // Attach permissions to user object for downstream use
                req.user.permissions = userPermissions;

                // Log successful authorization for staff
                logger.debug('Staff permission authorized from DB', {
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
