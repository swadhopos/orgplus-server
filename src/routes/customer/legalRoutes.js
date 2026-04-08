const express = require('express');
const router = express.Router();
const legalController = require('../../controllers/customer/legalController');

// Fetch legal content (ToS, Privacy Policy)
router.get('/:type', legalController.getLegalContent);

// Fetch FAQ
router.get('/faq', legalController.getFAQs);

module.exports = router;

module.exports = router;
