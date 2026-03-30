const { admin } = require('../config/firebase');
const { UnauthorizedError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Middleware to verify Firebase JWT and specifically require the 'orgMember' custom claim.
 * This ensures that only members (customers) can access the customer API, blocking staff/admin.
 */
exports.requireCustomerAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No authentication token provided');
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Check for the specific member custom claim
    if (decodedToken.role !== 'orgMember') {
      logger.warn('Forbidden member access attempt', { uid: decodedToken.uid, role: decodedToken.role });
      throw new UnauthorizedError('Access restricted to members only. Invalid role.');
    }

    // Attach user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: decodedToken.role,
      orgId: decodedToken.orgId,
      householdId: decodedToken.householdId
    };

    next();
  } catch (error) {
    next(new UnauthorizedError(error.message || 'Invalid or expired authentication token'));
  }
};
