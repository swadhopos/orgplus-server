const OrgConfig = require('../models/OrgConfig');
const { AuthorizationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Middleware factory to require a specific feature flag from OrgConfig
 * 
 * Ensures that the organization being accessed has the required module enabled.
 * Blocks requests with 403 Forbidden if the feature is disabled.
 * Caches the config on req.orgConfig for downstream use.
 * 
 * @param {string} flagKey - The feature flag to check (e.g., 'hasEvents', 'hasBMD')
 * @returns {Function} Express middleware function
 */
const requireFeature = (flagKey) => {
  return async (req, res, next) => {
    try {
      // System admins bypass all feature flag checks
      if (req.user && req.user.role === 'systemAdmin') {
        logger.debug('System admin bypassing feature check', {
          uid: req.user.uid,
          feature: flagKey,
          requestId: req.id
        });
        return next();
      }

      const { orgId } = req.params;
      if (!orgId) {
        return next(new AuthorizationError('Organization ID is required for feature check'));
      }

      // Fetch or use already attached config
      let config = req.orgConfig;
      if (!config) {
        config = await OrgConfig.findOne({ organizationId: orgId });
      }

      // If no config found, fallback to permissive (Support for legacy orgs)
      if (!config) {
        logger.warn('Legacy Organization: No OrgConfig found. Defaulting to ALLOW.', {
          orgId,
          uid: req.user?.uid,
          featureRequested: flagKey,
          requestId: req.id
        });
        return next();
      }

      // Track config on request for downstream usage
      req.orgConfig = config;

      // Check the flag
      if (!config.features[flagKey]) {
        logger.warn('Access denied: Module not enabled for this organization', {
          orgId,
          uid: req.user?.uid,
          featureRequired: flagKey,
          requestId: req.id
        });
        throw new AuthorizationError(`Access denied. The ${flagKey.replace('has', '')} module is not enabled for this organization.`);
      }

      next();
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return next(error);
      }
      logger.error('Unexpected error during feature authorization', {
        error: error.message,
        stack: error.stack,
        requestId: req.id
      });
      next(new AuthorizationError('Authorization failed during feature check'));
    }
  };
};

module.exports = {
  requireFeature
};
