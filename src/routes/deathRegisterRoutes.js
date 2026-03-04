const express = require('express');
const router = express.Router();
const deathRegisterController = require('../controllers/deathRegisterController');
// const { protect, authorize } = require('../middleware/auth'); // Optionally add auth middleware

router
    .route('/')
    .post(deathRegisterController.createDeathRecord)
    .get(deathRegisterController.getDeathRecords);

router
    .route('/:id')
    .get(deathRegisterController.getDeathRecordById)
    .put(deathRegisterController.updateDeathRecord)
    .delete(deathRegisterController.deleteDeathRecord);

router
    .route('/:id/verify')
    .post(deathRegisterController.verifyDeathRecord);

module.exports = router;
