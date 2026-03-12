const express = require('express');
const {
    assignPlan,
    getTargetSubscriptions,
    getPlanSubscriptions,
    collectPayment
} = require('../controllers/subscriptionController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router({ mergeParams: true });

// Protect all routes
router.use(authenticateToken);

router.post('/assign', assignPlan);
router.get('/target/:targetId', getTargetSubscriptions);
router.post('/:subscriptionId/pay', collectPayment);

module.exports = router;
