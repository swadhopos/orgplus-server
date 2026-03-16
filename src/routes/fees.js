const express = require('express');
const {
    getFeePlans,
    getFeePlan,
    createFeePlan,
    updateFeePlan,
    deleteFeePlan
} = require('../controllers/feeController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorize');
const { requireMainCommitteeAccess } = require('../middleware/committeeAuth');
const router = express.Router({ mergeParams: true });

// Protect all routes - require admin, systemAdmin, or an active main committee officer role
router.use(authenticateToken);
router.use(requireRole('systemAdmin', 'admin', 'orgMember'));
router.use(requireMainCommitteeAccess);

router.route('/')
    .get(getFeePlans)
    .post(createFeePlan);

router.get('/:id/stats', require('../controllers/feeController').getFeePlanStats);
router.get('/:planId/subscriptions', require('../controllers/subscriptionController').getPlanSubscriptions);

router.route('/:id')
    .get(getFeePlan)
    .put(updateFeePlan)
    .delete(deleteFeePlan);

module.exports = router;
