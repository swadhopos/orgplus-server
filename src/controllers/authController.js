/**
 * Authentication Controller for OrgPlus Multi-Tenant System
 * 
 * This controller handles authentication-related operations including
 * system bootstrap for creating the initial system admin user.
 */

const { createUser, setCustomClaims, getUserByEmail } = require('../config/firebase');
const { ConflictError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Bootstrap system admin user
 * 
 * Creates the initial system admin user with email nksuhail13@gmail.com.
 * This endpoint should only work once - subsequent calls are rejected if
 * a system admin already exists.
 * 
 * @route POST /api/auth/bootstrap
 * @access Public (but should be protected in production)
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * 
 * @returns {Object} 201 - Created user info { userId, email, role }
 * @throws {ConflictError} 409 - System admin already exists
 */
const bootstrap = async (req, res, next) => {
  const bootstrapEmail = 'nksuhail13@gmail.com';
  const bootstrapPassword = process.env.BOOTSTRAP_PASSWORD || 'TempPassword123!';
  
  try {
    // Log bootstrap attempt
    logger.info('Bootstrap attempt initiated', {
      timestamp: new Date().toISOString(),
      requestId: req.id
    });

    // SECURITY: Only allow bootstrap in development or with explicit override
    const isDevelopment = process.env.NODE_ENV === 'development';
    const allowBootstrap = process.env.ALLOW_BOOTSTRAP === 'true';

    if (!isDevelopment && !allowBootstrap) {
      logger.error('Bootstrap attempt blocked: Outside development environment without override', {
        requestId: req.id,
        nodeEnv: process.env.NODE_ENV
      });
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'System bootstrap is disabled in this environment'
        }
      });
    }

    // Check if system admin already exists
    // We'll check if a user with the bootstrap email exists and has systemAdmin role
    const existingUser = await getUserByEmail(bootstrapEmail);
    
    if (existingUser) {
      // Check if user has systemAdmin role in custom claims
      const customClaims = existingUser.customClaims || {};
      
      if (customClaims.role === 'systemAdmin') {
        logger.warn('Bootstrap rejected: System admin already exists', {
          userId: existingUser.uid,
          email: existingUser.email,
          timestamp: new Date().toISOString(),
          requestId: req.id
        });
        
        throw new ConflictError(
          'System admin already exists. Bootstrap can only be performed once.',
          { email: bootstrapEmail }
        );
      }
      
      // User exists but doesn't have systemAdmin role - update their claims
      logger.info('Existing user found without systemAdmin role, updating claims', {
        userId: existingUser.uid,
        email: existingUser.email,
        requestId: req.id
      });
      
      await setCustomClaims(existingUser.uid, { role: 'systemAdmin' });
      
      logger.info('Bootstrap completed successfully (existing user upgraded)', {
        userId: existingUser.uid,
        email: existingUser.email,
        role: 'systemAdmin',
        timestamp: new Date().toISOString(),
        requestId: req.id
      });
      
      return res.status(201).json({
        success: true,
        message: 'System admin user upgraded successfully',
        data: {
          userId: existingUser.uid,
          email: existingUser.email,
          role: 'systemAdmin'
        }
      });
    }

    // Create new Firebase user
    logger.info('Creating new system admin user', {
      email: bootstrapEmail,
      requestId: req.id
    });
    
    const userRecord = await createUser(bootstrapEmail, bootstrapPassword);
    
    // Set custom claims for systemAdmin role
    await setCustomClaims(userRecord.uid, { role: 'systemAdmin' });
    
    // Log successful bootstrap
    logger.info('Bootstrap completed successfully', {
      userId: userRecord.uid,
      email: userRecord.email,
      role: 'systemAdmin',
      timestamp: new Date().toISOString(),
      requestId: req.id
    });

    // Return success response
    res.status(201).json({
      success: true,
      message: 'System admin user created successfully',
      data: {
        userId: userRecord.uid,
        email: userRecord.email,
        role: 'systemAdmin'
      }
    });
  } catch (error) {
    // Log bootstrap failure
    logger.error('Bootstrap failed', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      requestId: req.id
    });

    // Pass error to error handler middleware
    next(error);
  }
};

module.exports = {
  bootstrap
};
