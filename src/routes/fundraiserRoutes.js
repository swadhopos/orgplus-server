const express = require('express');
const router = express.Router({ mergeParams: true });
const fundraiserController = require('../controllers/fundraiserController');
const { requireRole } = require('../middleware/authorize');
const { applyTenantFilter } = require('../middleware/tenantFilter');

// All fundraiser routes require tenant filtering
router.use(applyTenantFilter);

router.route('/')
    .get(fundraiserController.listFundraisers)
    .post(requireRole('admin', 'systemAdmin'), fundraiserController.createFundraiser);

router.route('/:id')
    .get(fundraiserController.getFundraiser)
    .patch(requireRole('admin', 'systemAdmin'), fundraiserController.updateFundraiser)
    .delete(requireRole('admin', 'systemAdmin'), fundraiserController.deleteFundraiser);

// Pledges
router.route('/:fundraiserId/pledges')
    .get(fundraiserController.listPledges)
    .post(requireRole('admin', 'systemAdmin'), fundraiserController.createPledge);

router.route('/:fundraiserId/pledges/:pledgeId')
    .patch(requireRole('admin', 'systemAdmin'), fundraiserController.updatePledge)
    .delete(requireRole('admin', 'systemAdmin'), fundraiserController.deletePledge);

router.patch('/:fundraiserId/pledges/:pledgeId/void', requireRole('admin', 'systemAdmin'), fundraiserController.voidPledge);

// Transactions
router.route('/:fundraiserId/transactions')
    .get(fundraiserController.listFundraiserTransactions)
    .post(requireRole('admin', 'systemAdmin'), fundraiserController.addFundraiserTransaction);

router.route('/:fundraiserId/transactions/:txId')
    .patch(requireRole('admin', 'systemAdmin'), fundraiserController.updateFundraiserTransaction)
    .delete(requireRole('admin', 'systemAdmin'), fundraiserController.deleteFundraiserTransaction);

router.patch('/:fundraiserId/transactions/:txId/void', requireRole('admin', 'systemAdmin'), fundraiserController.voidFundraiserTransaction);

module.exports = router;
