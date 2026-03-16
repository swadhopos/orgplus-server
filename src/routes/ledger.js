const express = require('express');
const router = express.Router({ mergeParams: true });
const ledgerController = require('../controllers/ledgerController');
const { requireRole } = require('../middleware/authorize');
const { applyTenantFilter } = require('../middleware/tenantFilter');

const { requireMainCommitteeAccess } = require('../middleware/committeeAuth');

// All routes require admin, systemAdmin, or an active main committee officer role
router.use(requireRole('systemAdmin', 'admin', 'orgMember'));
router.use(requireMainCommitteeAccess);

// All routes apply tenant filtering
router.use(applyTenantFilter);

// ── Ledger CRUD ────────────────────────────────────────────────────────────

// List ledgers       (GET /api/organizations/:orgId/ledgers?status=open)
router.get('/', ledgerController.listLedgers);

// Create ledger      (POST /api/organizations/:orgId/ledgers)
router.post('/', ledgerController.createLedger);

// Get ledger         (GET /api/organizations/:orgId/ledgers/:ledgerId)
router.get('/:ledgerId', ledgerController.getLedger);

// Update ledger      (PATCH /api/organizations/:orgId/ledgers/:ledgerId)
router.patch('/:ledgerId', ledgerController.updateLedger);

// Delete ledger      (DELETE /api/organizations/:orgId/ledgers/:ledgerId)
router.delete('/:ledgerId', ledgerController.deleteLedger);

// Financial summary  (GET /api/organizations/:orgId/ledgers/:ledgerId/summary)
router.get('/:ledgerId/summary', ledgerController.getLedgerSummary);

// ── Transaction sub-routes ─────────────────────────────────────────────────

// List transactions  (GET /api/organizations/:orgId/ledgers/:ledgerId/transactions)
router.get('/:ledgerId/transactions', ledgerController.listTransactions);

// Add transaction    (POST /api/organizations/:orgId/ledgers/:ledgerId/transactions)
router.post('/:ledgerId/transactions', ledgerController.addTransaction);

// Update transaction (PATCH /api/organizations/:orgId/ledgers/:ledgerId/transactions/:txId)
router.patch('/:ledgerId/transactions/:txId', ledgerController.updateTransaction);

// Void transaction  (PATCH /api/organizations/:orgId/ledgers/:ledgerId/transactions/:txId/void)
router.patch('/:ledgerId/transactions/:txId/void', ledgerController.voidTransaction);

// Delete transaction (DELETE /api/organizations/:orgId/ledgers/:ledgerId/transactions/:txId)
router.delete('/:ledgerId/transactions/:txId', ledgerController.deleteTransaction);

module.exports = router;
