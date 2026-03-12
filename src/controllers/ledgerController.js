const Ledger = require('../models/Ledger');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const { NotFoundError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

// ─────────────────────────────────────────────────────────────────
// LEDGER CRUD
// ─────────────────────────────────────────────────────────────────

/**
 * List all ledgers for an org
 * GET /api/organizations/:orgId/ledgers
 * Query: ?status=open|closed|archived
 */
exports.listLedgers = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const { status } = req.query;

        const query = { organizationId: orgId, 'audit.isDeleted': false };
        if (status) query.status = status;

        const ledgers = await Ledger.find(query).sort({ 'audit.createdAt': -1 });

        res.json({ success: true, data: ledgers });
    } catch (error) {
        next(error);
    }
};

/**
 * Create a ledger (book)
 * POST /api/organizations/:orgId/ledgers
 * Body: { name, description, fiscalYearStart, fiscalYearEnd, openingBalance, currency }
 */
exports.createLedger = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const {
            name, description,
            fiscalYearStart, fiscalYearEnd,
            openingBalance, currency
        } = req.body;

        if (!name) throw new ValidationError('Ledger name is required');

        const parsedOpeningBalance = parseFloat(openingBalance) || 0;

        const ledger = new Ledger({
            organizationId: orgId,
            name,
            description: description || null,
            fiscalYearStart: fiscalYearStart || null,
            fiscalYearEnd: fiscalYearEnd || null,
            openingBalance: parsedOpeningBalance,
            currency: currency || 'INR',
            status: 'open',
            audit: { createdByUserId: req.user.uid }
        });

        await ledger.save();

        // Auto-create Opening Balance transaction so it appears in the ledger list
        // and is included in the summary totals naturally (no double-counting).
        if (parsedOpeningBalance > 0) {
            const obTx = new Transaction({
                organizationId: orgId,
                sourceType: 'ledger',
                sourceId: ledger._id,
                type: 'income',
                amount: parsedOpeningBalance,
                date: fiscalYearStart ? new Date(fiscalYearStart) : new Date(),
                description: 'Opening Balance',
                status: 'completed',
                categoryId: null,
                categorySnapshot: 'Opening Balance',
                payment: { method: 'other', notes: 'Auto-generated from ledger opening balance' },
                audit: { createdByUserId: req.user.uid }
            });
            await obTx.save();
            logger.info('Opening Balance transaction created', {
                transactionId: obTx._id,
                ledgerId: ledger._id,
                amount: parsedOpeningBalance,
                organizationId: orgId
            });
        }

        logger.info('Ledger created', {
            ledgerId: ledger._id,
            organizationId: orgId,
            createdBy: req.user.uid
        });

        res.status(201).json({ success: true, data: ledger });
    } catch (error) {
        next(error);
    }
};

/**
 * Get a single ledger
 * GET /api/organizations/:orgId/ledgers/:ledgerId
 */
exports.getLedger = async (req, res, next) => {
    try {
        const { orgId, ledgerId } = req.params;

        const ledger = await Ledger.findOne({
            _id: ledgerId,
            organizationId: orgId,
            'audit.isDeleted': false
        });

        if (!ledger) throw new NotFoundError('Ledger not found');

        res.json({ success: true, data: ledger });
    } catch (error) {
        next(error);
    }
};

/**
 * Update a ledger
 * PATCH /api/organizations/:orgId/ledgers/:ledgerId
 * Body: { name, description, fiscalYearStart, fiscalYearEnd, openingBalance, currency, status }
 */
exports.updateLedger = async (req, res, next) => {
    try {
        const { orgId, ledgerId } = req.params;
        const {
            name, description,
            fiscalYearStart, fiscalYearEnd,
            openingBalance, currency, status
        } = req.body;

        const ledger = await Ledger.findOne({
            _id: ledgerId,
            organizationId: orgId,
            'audit.isDeleted': false
        });

        if (!ledger) throw new NotFoundError('Ledger not found');

        if (name !== undefined) ledger.name = name;
        if (description !== undefined) ledger.description = description;
        if (fiscalYearStart !== undefined) ledger.fiscalYearStart = fiscalYearStart;
        if (fiscalYearEnd !== undefined) ledger.fiscalYearEnd = fiscalYearEnd;
        if (openingBalance !== undefined) ledger.openingBalance = openingBalance;
        if (currency !== undefined) ledger.currency = currency;
        if (status !== undefined) ledger.status = status;

        ledger.audit.updatedByUserId = req.user.uid;
        ledger.audit.updatedAt = new Date();
        if (status) {
            ledger.audit.history.push({ action: 'status_changed', byUserId: req.user.uid, note: status });
        }

        await ledger.save();

        logger.info('Ledger updated', {
            ledgerId: ledger._id,
            organizationId: orgId,
            updatedBy: req.user.uid
        });

        res.json({ success: true, data: ledger });
    } catch (error) {
        next(error);
    }
};

/**
 * Soft-delete a ledger
 * DELETE /api/organizations/:orgId/ledgers/:ledgerId
 */
exports.deleteLedger = async (req, res, next) => {
    try {
        const { orgId, ledgerId } = req.params;
        const { reason } = req.body;

        const ledger = await Ledger.findOne({
            _id: ledgerId,
            organizationId: orgId,
            'audit.isDeleted': false
        });

        if (!ledger) throw new NotFoundError('Ledger not found');

        await ledger.softDelete(req.user.uid, reason || null);

        logger.info('Ledger deleted', {
            ledgerId: ledger._id,
            organizationId: orgId,
            deletedBy: req.user.uid
        });

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

/**
 * Get ledger financial summary (totals from transactions)
 * GET /api/organizations/:orgId/ledgers/:ledgerId/summary
 */
exports.getLedgerSummary = async (req, res, next) => {
    try {
        const { orgId, ledgerId } = req.params;

        const ledger = await Ledger.findOne({
            _id: ledgerId,
            organizationId: orgId,
            'audit.isDeleted': false
        });

        if (!ledger) throw new NotFoundError('Ledger not found');

        const summaryRows = await Transaction.summarizeBySource('ledger', ledgerId);

        let totalIncome = 0;
        let totalExpense = 0;
        summaryRows.forEach(({ _id, total }) => {
            if (_id === 'income' || _id === 'invoice') totalIncome += total;
            if (_id === 'expense') totalExpense = total;
        });

        // Opening balance is now a real income transaction — do NOT add it again.
        // netBalance = all income (including OB tx) - all expense
        const netBalance = totalIncome - totalExpense;

        res.json({
            success: true,
            data: {
                ledgerId,
                openingBalance: ledger.openingBalance,   // kept for display reference only
                totalIncome,
                totalExpense,
                netBalance
            }
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────
// TRANSACTION SUB-ROUTES  (scoped to a ledger)
// ─────────────────────────────────────────────────────────────────

/**
 * List transactions for a ledger
 * GET /api/organizations/:orgId/ledgers/:ledgerId/transactions
 * Query: ?type=income|expense  &categoryId=  &memberId=  &householdId=
 *        &from=ISO  &to=ISO  &page=1  &limit=20
 */
exports.listTransactions = async (req, res, next) => {
    try {
        const { orgId, ledgerId } = req.params;
        const {
            type, categoryId, memberId, householdId,
            from, to, status,
            page = 1, limit = 50
        } = req.query;

        // Verify ledger belongs to org
        const ledger = await Ledger.findOne({
            _id: ledgerId,
            organizationId: orgId,
            'audit.isDeleted': false
        });
        if (!ledger) throw new NotFoundError('Ledger not found');

        const filter = {
            organizationId: orgId,
            sourceType: 'ledger',
            sourceId: ledgerId,
            'audit.isDeleted': false
        };

        // Status filter: ‘voided’ shows only voided; default excludes voided
        if (status === 'voided') {
            filter.status = 'voided';
        } else if (status) {
            filter.status = status;
        } else {
            filter.status = { $ne: 'voided' };
        }

        if (type) filter.type = type;
        if (categoryId) filter.categoryId = categoryId;
        if (memberId) filter.memberId = memberId;
        if (householdId) filter.householdId = householdId;
        if (from || to) {
            filter.date = {};
            if (from) filter.date.$gte = new Date(from);
            if (to) filter.date.$lte = new Date(to);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await Transaction.countDocuments(filter);

        const transactions = await Transaction.find(filter)
            .sort({ date: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('categoryId', 'name color icon')
            .populate('memberId', 'fullName memberNumber')
            .populate('householdId', 'houseName houseNumber');

        res.json({
            success: true,
            data: transactions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Add a transaction to a ledger
 * POST /api/organizations/:orgId/ledgers/:ledgerId/transactions
 * Body: {
 *   type, amount, date, description, status,
 *   categoryId,
 *   memberId, householdId,       (at most one)
 *   payment: { method, referenceNumber, attachmentUrl, paidAt, receivedByUserId, notes }
 * }
 */
exports.addTransaction = async (req, res, next) => {
    try {
        const { orgId, ledgerId } = req.params;
        const {
            type, amount, date, description, status,
            categoryId, memberId, householdId,
            payment
        } = req.body;

        // Basic validation
        if (!type) throw new ValidationError('Transaction type is required');
        if (!amount) throw new ValidationError('Amount is required');

        // Must not set both memberId and householdId
        if (memberId && householdId) {
            throw new ValidationError('A transaction can be linked to either a member or a household, not both');
        }

        // Verify ledger belongs to org
        const ledger = await Ledger.findOne({
            _id: ledgerId,
            organizationId: orgId,
            'audit.isDeleted': false
        });
        if (!ledger) throw new NotFoundError('Ledger not found');

        // Snapshot category name to avoid populate on every list
        let categorySnapshot = null;
        if (categoryId) {
            const cat = await Category.findOne({
                _id: categoryId,
                organizationId: orgId,
                'audit.isDeleted': false
            });
            if (!cat) throw new NotFoundError('Category not found');
            categorySnapshot = cat.name;
        }

        const tx = new Transaction({
            organizationId: orgId,
            sourceType: 'ledger',
            sourceId: ledgerId,
            type,
            amount,
            date: date || new Date(),
            description: description || null,
            status: status || 'completed',
            categoryId: categoryId || null,
            categorySnapshot: categorySnapshot || null,
            memberId: memberId || null,
            householdId: householdId || null,
            payment: payment || {},
            audit: { createdByUserId: req.user.uid }
        });

        await tx.save();

        logger.info('Transaction added to ledger', {
            transactionId: tx._id,
            ledgerId,
            organizationId: orgId,
            createdBy: req.user.uid
        });

        res.status(201).json({ success: true, data: tx });
    } catch (error) {
        next(error);
    }
};

/**
 * Update a transaction
 * PATCH /api/organizations/:orgId/ledgers/:ledgerId/transactions/:txId
 */
exports.updateTransaction = async (req, res, next) => {
    try {
        const { orgId, ledgerId, txId } = req.params;
        const {
            type, amount, date, description, status,
            categoryId, memberId, householdId,
            payment
        } = req.body;

        if (memberId && householdId) {
            throw new ValidationError('A transaction can be linked to either a member or a household, not both');
        }

        const tx = await Transaction.findOne({
            _id: txId,
            organizationId: orgId,
            sourceType: 'ledger',
            sourceId: ledgerId,
            'audit.isDeleted': false
        });

        if (!tx) throw new NotFoundError('Transaction not found');

        if (type !== undefined) tx.type = type;
        if (amount !== undefined) tx.amount = amount;
        if (date !== undefined) tx.date = date;
        if (description !== undefined) tx.description = description;
        if (status !== undefined) tx.status = status;
        if (memberId !== undefined) tx.memberId = memberId || null;
        if (householdId !== undefined) tx.householdId = householdId || null;

        if (categoryId !== undefined) {
            tx.categoryId = categoryId || null;
            if (categoryId) {
                const cat = await Category.findOne({
                    _id: categoryId,
                    organizationId: orgId,
                    'audit.isDeleted': false
                });
                if (!cat) throw new NotFoundError('Category not found');
                tx.categorySnapshot = cat.name;
            } else {
                tx.categorySnapshot = null;
            }
        }

        if (payment !== undefined) {
            Object.assign(tx.payment, payment);
        }

        tx.audit.updatedByUserId = req.user.uid;
        tx.audit.updatedAt = new Date();
        tx.audit.history.push({ action: 'updated', byUserId: req.user.uid });

        await tx.save();

        logger.info('Transaction updated', {
            transactionId: tx._id,
            ledgerId,
            organizationId: orgId,
            updatedBy: req.user.uid
        });

        res.json({ success: true, data: tx });
    } catch (error) {
        next(error);
    }
};

/**
 * Soft-delete a transaction
 * DELETE /api/organizations/:orgId/ledgers/:ledgerId/transactions/:txId
 */
exports.deleteTransaction = async (req, res, next) => {
    try {
        const { orgId, ledgerId, txId } = req.params;
        const { reason } = req.body;

        const tx = await Transaction.findOne({
            _id: txId,
            organizationId: orgId,
            sourceType: 'ledger',
            sourceId: ledgerId,
            'audit.isDeleted': false
        });

        if (!tx) throw new NotFoundError('Transaction not found');

        await tx.softDelete(req.user.uid, reason || null);

        logger.info('Transaction deleted', {
            transactionId: tx._id,
            ledgerId,
            organizationId: orgId,
            deletedBy: req.user.uid
        });

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

/**
 * Void a transaction (compliance-safe — never deleted, just marked voided)
 * PATCH /api/organizations/:orgId/ledgers/:ledgerId/transactions/:txId/void
 * Body: { reason: string }
 */
exports.voidTransaction = async (req, res, next) => {
    try {
        const { orgId, ledgerId, txId } = req.params;
        const { reason } = req.body;

        if (!reason || !reason.trim()) {
            throw new ValidationError('A void reason is required');
        }

        const tx = await Transaction.findOne({
            _id: txId,
            organizationId: orgId,
            sourceType: 'ledger',
            sourceId: ledgerId,
            'audit.isDeleted': false
        });

        if (!tx) throw new NotFoundError('Transaction not found');
        if (tx.status === 'voided') {
            throw new ValidationError('Transaction is already voided');
        }

        await tx.voidTransaction(req.user.uid, reason.trim());

        logger.info('Transaction voided', {
            transactionId: tx._id,
            ledgerId,
            organizationId: orgId,
            voidedBy: req.user.uid,
            reason: reason.trim()
        });

        res.json({ success: true, data: tx });
    } catch (error) {
        next(error);
    }
};
