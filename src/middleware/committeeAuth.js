/**
 * Main Committee Authorization Middleware
 * 
 * Verifies that the authenticated user is currently an active member
 * with a privileged role in the organization's Main Committee.
 */

const { AuthorizationError } = require('../utils/errors');
const logger = require('../utils/logger');
const CommitteeMember = require('../models/CommitteeMember');

const PRIVILEGED_ROLES = ['president', 'vice-president', 'secretary', 'treasurer'];

const requireMainCommitteeAccess = async (req, res, next) => {
  try {
    // 1. Role Bypass: System Admins, Organization Admins, and Staff bypass all committee checks
    // Staff are authorized via granular permissions instead of committee roles
    if (req.user && (req.user.role === 'systemAdmin' || req.user.role === 'admin' || req.user.role === 'staff')) {
      return next();
    }

    // 2. Basic user checks for committee members
    if (!req.user || !req.user.uid || !req.user.memberId) {
       logger.warn('Main committee check failed: Missing user, uid, or memberId in token', { 
           user: req.user ? { uid: req.user.uid, role: req.user.role } : 'null',
           requestId: req.id
       });
       throw new AuthorizationError('You do not have portal access. Please contact an administrator.');
    }

    const orgId = req.params.orgId || req.user.orgId;

    if (!orgId) {
       throw new AuthorizationError('Organization ID is required for access check.');
    }

    // 2. Database Check
    // Look for an active committee member record for this memberId, in a privileged role, 
    // linked to a committee that is marked as `isMain: true`.
    
    // First, find the main committee for this org
    const Committee = require('../models/Committee');
    const mainCommittee = await Committee.findOne({ 
        organizationId: orgId, 
        isMain: true, 
        isDeleted: false,
        status: 'active'
    });

    if (!mainCommittee) {
        logger.warn('Main committee check failed: No active main committee found for org', { orgId });
        throw new AuthorizationError('No active Main Committee is designated for this organization.');
    }

    // Second, verify the user is an active privileged officer in that committee
    const isOfficer = await CommitteeMember.findOne({
        committeeId: mainCommittee._id,
        memberId: req.user.memberId,
        organizationId: orgId,
        status: 'active',
        role: { $in: PRIVILEGED_ROLES }
    });

    if (!isOfficer) {
        logger.warn('Main committee check failed: User is not an active privileged officer in the main committee', {
            uid: req.user.uid,
            memberId: req.user.memberId,
            orgId
        });
        throw new AuthorizationError('Access denied. You must be an active officer of the Main Committee.');
    }

    // Authorization successful
    logger.debug('Main committee access granted', {
        uid: req.user.uid,
        memberId: req.user.memberId,
        orgId
    });

    next();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return next(error);
    }
    
    logger.error('Unexpected error during main committee authorization', {
      error: error.message,
      stack: error.stack,
      requestId: req.id
    });
    next(new AuthorizationError('Authorization failed'));
  }
};

module.exports = {
  requireMainCommitteeAccess
};
