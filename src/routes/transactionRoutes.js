const express = require('express');
const router = express.Router({ mergeParams: true });
const transactionController = require('../controllers/transactionController');

// All routes here are mounted under /api/organizations/:orgId/transactions and are protected
// by authenticateToken and requireOrgAccess in app.js

router.post('/:txId/generate-receipt-number', transactionController.generateReceipt);
router.get('/:txId', transactionController.getTransaction);

module.exports = router;
