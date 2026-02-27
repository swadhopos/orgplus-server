/**
 * Authentication Routes for OrgPlus Multi-Tenant System
 * 
 * This module defines routes for authentication-related operations.
 */

const express = require('express');
const { bootstrap } = require('../controllers/authController');

const router = express.Router();

/**
 * @route POST /api/auth/bootstrap
 * @desc Bootstrap system admin user
 * @access Public (should be protected in production)
 */
router.post('/bootstrap', bootstrap);

module.exports = router;
