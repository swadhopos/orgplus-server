const express = require('express');
const { getDashboardSummary, getDemographicReport, getFinancialReport } = require('../controllers/analyticsController');

// MUST use mergeParams to access :orgId from parent route
const router = express.Router({ mergeParams: true });

router.get('/dashboard', getDashboardSummary);
router.get('/reports/demographic', getDemographicReport);
router.get('/reports/financial', getFinancialReport);

module.exports = router;
