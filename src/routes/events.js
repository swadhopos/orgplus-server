const express = require('express');
const router = express.Router({ mergeParams: true });
const ctrl = require('../controllers/eventController');
const { requireRole } = require('../middleware/authorize');
const { applyTenantFilter } = require('../middleware/tenantFilter');

// All event routes require at least admin role
router.use(requireRole('systemAdmin', 'admin'));
router.use(applyTenantFilter);

// ── Events ────────────────────────────────────────────────────────────────────
router.post('/', ctrl.createEvent);
router.get('/', ctrl.listEvents);
router.get('/:id', ctrl.getEvent);
router.patch('/:id', ctrl.updateEvent);
router.delete('/:id', ctrl.deleteEvent);

// ── Sponsors ──────────────────────────────────────────────────────────────────
router.get('/:eventId/sponsors', ctrl.listSponsors);
router.post('/:eventId/sponsors', ctrl.createSponsor);
router.patch('/:eventId/sponsors/:sponsorId', ctrl.updateSponsor);
router.delete('/:eventId/sponsors/:sponsorId', ctrl.deleteSponsor);
router.patch('/:eventId/sponsors/:sponsorId/void', ctrl.voidSponsor);

// ── Event Transactions ────────────────────────────────────────────────────────
router.get('/:eventId/transactions', ctrl.listEventTransactions);
router.post('/:eventId/transactions', ctrl.addEventTransaction);
router.patch('/:eventId/transactions/:txId', ctrl.updateEventTransaction);
router.delete('/:eventId/transactions/:txId', ctrl.deleteEventTransaction);
router.patch('/:eventId/transactions/:txId/void', ctrl.voidEventTransaction);

module.exports = router;
