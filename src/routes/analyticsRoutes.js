const express = require('express');
const { getDashboardSummary, getDemographicReport, getFinancialReport } = require('../controllers/analyticsController');
const { requireRole } = require('../middleware/authorize');
const { requirePermission } = require('../middleware/permission');

// MUST use mergeParams to access :orgId from parent route
const router = express.Router({ mergeParams: true });

// Require basic staff or admin access
router.use(requireRole('systemAdmin', 'admin', 'staff', 'orgMember'));

// For staff, allow dashboard access if they have reports, members, households, or triage permissions
router.get('/dashboard', requirePermission('canViewReports', 'canManageMembers', 'canManageHouseholds', 'canTriageMembers'), getDashboardSummary);

// Standard reports require view reports permission specifically
router.get('/reports/demographic', requirePermission('canViewReports'), getDemographicReport);
router.get('/reports/financial', requirePermission('canViewReports'), getFinancialReport);

module.exports = router;
