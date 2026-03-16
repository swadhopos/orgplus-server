const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken } = require('../middleware/auth');
const { requireMainCommitteeAccess } = require('../middleware/committeeAuth');
const deathRegisterController = require('../controllers/deathRegisterController');

// All routes require authentication
router.use(authenticateToken);
router.use(requireMainCommitteeAccess);

router.route('/')
    .post(deathRegisterController.createDeathRecord)
    .get(deathRegisterController.getDeathRecords);

router.route('/:id')
    .get(deathRegisterController.getDeathRecordById)
    .put(deathRegisterController.updateDeathRecord)
    .delete(deathRegisterController.deleteDeathRecord);

// Committee approval — casts a vote; marks verified when threshold is reached
router.route('/:id/approve')
    .post(deathRegisterController.approveDeath);

// Admin rejection only (verified records stay verified)
router.route('/:id/status')
    .put(deathRegisterController.verifyDeathRecord);

module.exports = router;
