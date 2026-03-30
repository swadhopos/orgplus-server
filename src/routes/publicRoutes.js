const express = require('express');
const rateLimit = require('express-rate-limit');
const { verifyCertificate } = require('../controllers/publicController');

const router = express.Router();

/**
 * Strict Rate Limiter for Verification Endpoint
 * Limits each IP to 5 requests per 15 minutes to prevent brute-force attacks.
 */
const verifyStrictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 mins
    max: 5, // Limit each IP to 5 requests per windowMs
    message: {
        success: false,
        error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many verification attempts from this IP, please try again after 15 minutes'
        }
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// @route   POST /api/public/verify-certificate
// @desc    Verify a certificate by ID and holder's Date of Birth
// @access  Public (Rate-limited)
router.post('/verify-certificate', verifyStrictLimiter, verifyCertificate);

module.exports = router;
