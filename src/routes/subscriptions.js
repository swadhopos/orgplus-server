const express = require('express');
const {
    assignPlan,
    getTargetSubscriptions,
    getPlanSubscriptions,
    collectPayment
} = require('../controllers/subscriptionController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorize');
const { requireMainCommitteeAccess } = require('../middleware/committeeAuth');
const router = express.Router({ mergeParams: true });

// Protect all routes - require admin, systemAdmin, or an active main committee officer role
router.use(authenticateToken);
router.use(requireRole('systemAdmin', 'admin', 'orgMember'));
router.use(requireMainCommitteeAccess);

router.post('/assign', assignPlan);
router.get('/target/:targetId', getTargetSubscriptions);
router.post('/:subscriptionId/pay', collectPayment);

module.exports = router;
