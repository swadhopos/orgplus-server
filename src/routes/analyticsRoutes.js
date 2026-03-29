const express = require('express');
const { getDashboardSummary, getDemographicReport, getFinancialReport } = require('../controllers/analyticsController');
const { requireRole } = require('../middleware/authorize');
const { requirePermission } = require('../middleware/permission');

// MUST use mergeParams to access :orgId from parent route
const router = express.Router({ mergeParams: true });

// Require basic staff or admin access
router.use(requireRole('systemAdmin', 'admin', 'staff', 'orgMember'));

// For staff, require report viewing permission
router.use(requirePermission('canViewReports'));

router.get('/dashboard', getDashboardSummary);
router.get('/reports/demographic', getDemographicReport);
router.get('/reports/financial', getFinancialReport);

module.exports = router;
