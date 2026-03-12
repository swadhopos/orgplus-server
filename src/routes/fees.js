const express = require('express');
const {
    getFeePlans,
    getFeePlan,
    createFeePlan,
    updateFeePlan,
    deleteFeePlan
} = require('../controllers/feeController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router({ mergeParams: true });

// Protect all routes
router.use(authenticateToken);

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
