const { admin } = require('../../config/firebase');
const Member = require('../../models/Member');
const { AuthenticationError, AuthorizationError, NotFoundError } = require('../../utils/errors');
const logger = require('../../utils/logger');

/**
 * Handle initial login verification for a customer after they sign in with Firebase on the client.
 */
exports.login = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      throw new AuthenticationError('Token is required');
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    if (decodedToken.role !== 'orgMember') {
      logger.warn('Unauthorized login attempt by non-member', { uid: decodedToken.uid });
      throw new AuthorizationError('Access restricted to members only.');
    }

    const member = await Member.findOne({ userId: decodedToken.uid, isDeleted: false })
      .select('fullName memberNumber currentHouseholdId organizationId status')
      .lean();

    if (!member) {
      throw new NotFoundError('Member record not found.');
    }

    res.json({
      success: true,
      data: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        memberInfo: member
      }
    });

  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError || error instanceof NotFoundError) {
      return next(error);
    }
    next(new AuthenticationError(error.message || 'Invalid authentication token'));
  }
};

/**
 * Get profile data of the logged-in member.
 */
exports.getProfile = async (req, res, next) => {
  try {
    const member = await Member.findOne({ userId: req.user.uid, isDeleted: false })
      .populate('currentHouseholdId', 'houseName houseNumber status')
      .populate('organizationId', 'name logoUrl primaryColor secondaryColor type')
      .lean();

    if (!member) {
      throw new NotFoundError('Profile not found.');
    }

    res.json({
      success: true,
      data: member
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change Firebase Password.
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    
    await admin.auth().updateUser(req.user.uid, {
      password: newPassword
    });

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    next(error);
  }
};
