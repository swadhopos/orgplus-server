/**
 * Authentication Middleware for OrgPlus Multi-Tenant System
 * 
 * This middleware verifies Firebase ID tokens and extracts user information
 * including custom claims (role, orgId, householdId) for use in authorization.
 */

const { verifyIdToken } = require('../config/firebase');
const { AuthenticationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Middleware to authenticate Firebase tokens
 * 
 * Extracts the token from the Authorization header, verifies it using Firebase Admin SDK,
 * and attaches user information to req.user for downstream middleware and controllers.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * 
 * @throws {AuthenticationError} When token is missing, invalid, or expired
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AuthenticationError('Authorization header missing');
    }

    // Check for Bearer token format
    if (!authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Invalid authorization header format. Expected: Bearer <token>');
    }

    // Extract the token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token || token.trim() === '') {
      throw new AuthenticationError('Token is empty');
    }

    // Verify token using Firebase Admin SDK
    const decodedToken = await verifyIdToken(token);

    // Extract user information and custom claims
    const userInfo = {
      id: decodedToken.uid,
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      role: decodedToken.role || null,
      organizationId: decodedToken.orgId || null,
      orgId: decodedToken.orgId || null,
      householdId: decodedToken.householdId || null,
      memberId: decodedToken.memberId || null,
      isCommitteeAccount: decodedToken.isCommitteeAccount || false,
      isCommitteeOfficer: decodedToken.isCommitteeOfficer || false,
      permissions: decodedToken.permissions || []
    };

    // Attach user info to request object
    req.user = userInfo;

    // Log successful authentication
    logger.debug('User authenticated successfully', {
      uid: userInfo.uid,
      email: userInfo.email,
      role: userInfo.role,
      requestId: req.id
    });

    next();
  } catch (error) {
    // Handle Firebase-specific errors
    if (error.code === 'auth/id-token-expired') {
      return next(new AuthenticationError('Token has expired'));
    }

    if (error.code === 'auth/id-token-revoked') {
      return next(new AuthenticationError('Token has been revoked'));
    }

    if (error.code === 'auth/invalid-id-token') {
      return next(new AuthenticationError('Invalid token'));
    }

    if (error.code === 'auth/argument-error') {
      return next(new AuthenticationError('Malformed token'));
    }

    // If it's already an AuthenticationError, pass it through
    if (error instanceof AuthenticationError) {
      return next(error);
    }

    // Log unexpected errors
    logger.error('Unexpected error during token verification', {
      error: error.message,
      stack: error.stack,
      requestId: req.id
    });

    // Return generic authentication error for unexpected errors
    next(new AuthenticationError('Authentication failed'));
  }
};

/**
 * Optional middleware to authenticate token but not fail if missing
 * Useful for endpoints that have optional authentication
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const authenticateTokenOptional = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // If no auth header, just continue without user info
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);

    if (!token || token.trim() === '') {
      req.user = null;
      return next();
    }

    // Try to verify token
    const decodedToken = await verifyIdToken(token);

    // Extract user information and custom claims
    const userInfo = {
      id: decodedToken.uid,
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      role: decodedToken.role || null,
      organizationId: decodedToken.orgId || null,
      orgId: decodedToken.orgId || null,
      householdId: decodedToken.householdId || null,
      memberId: decodedToken.memberId || null,
      isCommitteeAccount: decodedToken.isCommitteeAccount || false,
      isCommitteeOfficer: decodedToken.isCommitteeOfficer || false,
      permissions: decodedToken.permissions || []
    };

    req.user = userInfo;

    next();
  } catch (error) {
    // For optional auth, invalid tokens result in no user info
    req.user = null;
    next();
  }
};

module.exports = {
  authenticateToken,
  authenticateTokenOptional
};
