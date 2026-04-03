const mongoose = require('mongoose');
const Fundraiser = require('../models/Fundraiser');
const Sponsor = require('../models/Sponsor');
const Committee = require('../models/Committee');
const Transaction = require('../models/Transaction');
const { NotFoundError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');
const { ensureReceiptNumber } = require('./transactionController');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function paginate(page, limit) {
    const p = Math.max(1, parseInt(page) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit) || 50));
    return { page: p, limit: l, skip: (p - 1) * l };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNDRAISERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /organizations/:orgId/fundraisers
 */
exports.createFundraiser = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const { name, description, type, status, goalAmount, currency, startDate, endDate, visibility, upiAddress } = req.body;

        if (!name || !goalAmount || !startDate) {
            throw new ValidationError('Missing required fields: name, goalAmount, startDate');
        }

        const fundraiser = new Fundraiser({
            organizationId: orgId,
            name,
            description: description || null,
            type: type || 'charity',
            status: status || 'active',
            goalAmount: Number(goalAmount),
            currency: currency || 'INR',
            startDate,
            endDate: endDate || null,
            visibility: visibility || 'public',
            upiAddress: upiAddress || null,
            createdByUserId: req.user.uid
        });

        await fundraiser.save();

        logger.info('Fundraiser created', { fundraiserId: fundraiser._id, organizationId: orgId, createdBy: req.user.uid });

        res.status(201).json({ success: true, data: fundraiser });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /organizations/:orgId/fundraisers
 */
exports.listFundraisers = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const { page, limit, status, type, search } = req.query;
        const { page: p, limit: l, skip } = paginate(page, limit);

        const filter = { ...req.tenantFilter, isDeleted: false };
        if (status) filter.status = status;
        if (type) filter.type = type;
        if (search) filter.name = { $regex: search, $options: 'i' };

        const [fundraisers, total] = await Promise.all([
            Fundraiser.find(filter).sort({ startDate: -1 }).skip(skip).limit(l),
            Fundraiser.countDocuments(filter)
        ]);

        // Efficiently fetch progress for all fundraisers in this page using aggregation
        const fundraiserIds = fundraisers.map(f => f._id);
        const progressStats = await Transaction.aggregate([
            {
                $match: {
                    organizationId: new mongoose.Types.ObjectId(orgId),
                    sourceType: 'fundraiser',
                    sourceId: { $in: fundraiserIds },
                    'audit.isDeleted': false,
                    status: { $in: ['completed', 'pending'] },
                    type: { $in: ['income', 'invoice'] }
                }
            },
            {
                $group: {
                    _id: '$sourceId',
                    totalRaised: { $sum: '$amount' }
                }
            }
        ]);

        const progressMap = progressStats.reduce((acc, stat) => {
            acc[stat._id.toString()] = stat.totalRaised;
            return acc;
        }, {});

        const fundraisersWithProgress = fundraisers.map(f => ({
            ...f.toObject(),
            raisedAmount: progressMap[f._id.toString()] || 0
        }));

        res.json({
            success: true,
            data: fundraisersWithProgress,
            pagination: { page: p, limit: l, total, pages: Math.ceil(total / l) }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /organizations/:orgId/fundraisers/:id
 */
exports.getFundraiser = async (req, res, next) => {
    try {
        const { orgId, id } = req.params;

        const fundraiser = await Fundraiser.findOne({ _id: id, organizationId: orgId, isDeleted: false });
        if (!fundraiser) throw new NotFoundError('Fundraiser not found');

        const [raisedStats, pledgeStats, committee, pledgeCount] = await Promise.all([
            // Actual money raised (Transactions)
            Transaction.aggregate([
                {
                    $match: {
                        organizationId: new mongoose.Types.ObjectId(orgId),
                        sourceType: 'fundraiser',
                        sourceId: new mongoose.Types.ObjectId(id),
                        'audit.isDeleted': false,
                        status: { $in: ['completed', 'pending'] },
                        type: { $in: ['income', 'invoice'] }
                    }
                },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),

            // Total Pledged (Sponsors - including pending/not-yet-paid)
            Sponsor.aggregate([
                {
                    $match: {
                        fundraiserId: new mongoose.Types.ObjectId(id),
                        isDeleted: false,
                        status: { $in: ['confirmed', 'pending'] }
                    }
                },
                { $group: { _id: null, totalPledged: { $sum: '$amount' } } }
            ]),

            Committee.findOne({ fundraiserId: id, organizationId: orgId, isDeleted: false }),

            Sponsor.countDocuments({ fundraiserId: id, isDeleted: false })
        ]);

        const raisedAmount = raisedStats[0]?.total || 0;
        const totalPledged = pledgeStats[0]?.totalPledged || 0;

        res.json({
            success: true,
            data: {
                ...fundraiser.toObject(),
                raisedAmount,
                totalPledged,
                _counts: { pledges: pledgeCount },
                committee: committee || null
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /organizations/:orgId/fundraisers/:id
 */
exports.updateFundraiser = async (req, res, next) => {
    try {
        const { orgId, id } = req.params;
        const updates = req.body;

        const fundraiser = await Fundraiser.findOneAndUpdate(
            { _id: id, organizationId: orgId, isDeleted: false },
            { $set: updates, updatedAt: new Date() },
            { new: true, runValidators: true }
        );

        if (!fundraiser) throw new NotFoundError('Fundraiser not found');

        logger.info('Fundraiser updated', { fundraiserId: id, organizationId: orgId, updatedBy: req.user.uid });

        res.json({ success: true, data: fundraiser });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /organizations/:orgId/fundraisers/:id
 */
exports.deleteFundraiser = async (req, res, next) => {
    try {
        const { orgId, id } = req.params;

        const fundraiser = await Fundraiser.findOne({ _id: id, organizationId: orgId, isDeleted: false });
        if (!fundraiser) throw new NotFoundError('Fundraiser not found');

        fundraiser.isDeleted = true;
        fundraiser.deletedAt = new Date();
        fundraiser.deletedByUserId = req.user.uid;
        await fundraiser.save();

        logger.info('Fundraiser deleted', { fundraiserId: id, organizationId: orgId, deletedBy: req.user.uid });

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// PLEDGES (SPONSORS)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /organizations/:orgId/fundraisers/:fundraiserId/pledges
 */
exports.listPledges = async (req, res, next) => {
    try {
        const { orgId, fundraiserId } = req.params;
        const { page, limit, status } = req.query;
        const { page: p, limit: l, skip } = paginate(page, limit);

        const fundraiser = await Fundraiser.findOne({ _id: fundraiserId, organizationId: orgId, isDeleted: false }).select('_id');
        if (!fundraiser) throw new NotFoundError('Fundraiser not found');

        const filter = { ...req.tenantFilter, fundraiserId, isDeleted: false };
        if (status) filter.status = status;

        const [pledges, total] = await Promise.all([
            Sponsor.find(filter)
                .populate('memberId', 'fullName memberNumber')
                .populate('householdId', 'houseName houseNumber')
                .populate('careOfMemberId', 'fullName memberNumber')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(l),
            Sponsor.countDocuments(filter)
        ]);

        res.json({
            success: true,
            data: pledges,
            pagination: { page: p, limit: l, total, pages: Math.ceil(total / l) }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /organizations/:orgId/fundraisers/:fundraiserId/pledges
 */
exports.createPledge = async (req, res, next) => {
    try {
        const { orgId, fundraiserId } = req.params;
        const {
            sponsorType, memberId, householdId, externalName,
            amount, currency, type, status, notes,
            contactPerson, contactPhone, contactEmail, careOfMemberId,
            createTransaction, paymentMethod, referenceNumber
        } = req.body;

        if (!sponsorType || amount == null) {
            throw new ValidationError('Missing required fields: sponsorType, amount');
        }

        const fundraiser = await Fundraiser.findOne({ _id: fundraiserId, organizationId: orgId, isDeleted: false });
        if (!fundraiser) throw new NotFoundError('Fundraiser not found');

        const pledge = new Sponsor({
            organizationId: orgId,
            fundraiserId,
            sponsorType,
            memberId: sponsorType === 'member' ? memberId : null,
            householdId: sponsorType === 'household' ? householdId : null,
            externalName: sponsorType === 'external' ? externalName : null,
            careOfMemberId: sponsorType === 'external' ? (careOfMemberId || null) : null,
            contactPerson: contactPerson || null,
            contactPhone: contactPhone || null,
            contactEmail: contactEmail || null,
            amount: Number(amount),
            currency: fundraiser.currency || 'INR',
            type: type || 'cash',
            status: status || 'pending', // Default to pending for new pledges
            notes: notes || null,
            entrySource: 'org',
            createdByUserId: req.user.uid
        });

        await pledge.save();

        let automaticallyCreatedTransaction = null;
        // Only create if explicitly requested, pledge is confirmed, and it's a cash pledge
        if (createTransaction && pledge.status === 'confirmed' && pledge.type === 'cash') {
            const transaction = new Transaction({
                organizationId: orgId,
                sourceType: 'fundraiser',
                sourceId: fundraiserId,
                type: 'income',
                amount: pledge.amount,
                currency: pledge.currency || 'INR',
                date: new Date(),
                description: `Pledge Payment: ${pledge.sponsorType === 'member' ? 'Member' :
                    pledge.sponsorType === 'household' ? 'Household' : pledge.externalName || 'External'
                    }`,
                memberId: pledge.sponsorType === 'member' ? pledge.memberId : null,
                householdId: pledge.sponsorType === 'household' ? pledge.householdId : null,
                payment: {
                    method: paymentMethod || 'cash',
                    referenceNumber: referenceNumber || null,
                    notes: 'Automatically created from pledge confirmation'
                },
                status: 'completed',
                audit: {
                    createdByUserId: req.user.uid || 'system'
                }
            });

            await transaction.save();
            await ensureReceiptNumber(transaction, orgId);
            automaticallyCreatedTransaction = transaction;
        }

        await pledge.populate([
            { path: 'memberId', select: 'fullName memberNumber' },
            { path: 'householdId', select: 'houseName houseNumber' },
            { path: 'careOfMemberId', select: 'fullName memberNumber' }
        ]);

        logger.info('Pledge created', { pledgeId: pledge._id, fundraiserId, organizationId: orgId, generatedTransaction: !!automaticallyCreatedTransaction });

        res.status(201).json({ success: true, data: pledge, transaction: automaticallyCreatedTransaction });
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /organizations/:orgId/fundraisers/:fundraiserId/pledges/:pledgeId
 */
exports.updatePledge = async (req, res, next) => {
    try {
        const { orgId, fundraiserId, pledgeId } = req.params;
        const updates = req.body;

        const pledge = await Sponsor.findOne({ _id: pledgeId, fundraiserId, organizationId: orgId, isDeleted: false });
        if (!pledge) throw new NotFoundError('Pledge not found');

        if (pledge.status === 'voided') {
            throw new ValidationError('Cannot edit a voided pledge.');
        }

        const oldStatus = pledge.status;

        // Strip special fields from updates to prevent tampering
        const { createTransaction, paymentMethod, referenceNumber, ...pledgeUpdates } = updates;

        if (pledgeUpdates.amount) pledgeUpdates.amount = Number(pledgeUpdates.amount);

        Object.assign(pledge, pledgeUpdates);
        pledge.updatedAt = new Date();
        await pledge.save();

        let automaticallyCreatedTransaction = null;
        // Only create if we are now confirming, we weren't confirmed before (or this is explicitly requested), and it's cash
        if (createTransaction && pledge.status === 'confirmed' && oldStatus !== 'confirmed' && pledge.type === 'cash') {
            const transaction = new Transaction({
                organizationId: orgId,
                sourceType: 'fundraiser',
                sourceId: fundraiserId,
                type: 'income',
                amount: pledge.amount,
                currency: pledge.currency || 'INR',
                date: new Date(),
                description: `Pledge Payment: ${pledge.sponsorType === 'member' ? 'Member' :
                    pledge.sponsorType === 'household' ? 'Household' : pledge.externalName || 'External'
                    }`,
                memberId: pledge.sponsorType === 'member' ? pledge.memberId : null,
                householdId: pledge.sponsorType === 'household' ? pledge.householdId : null,
                payment: {
                    method: paymentMethod || 'cash',
                    referenceNumber: referenceNumber || null,
                    notes: 'Automatically created from pledge update'
                },
                status: 'completed',
                audit: {
                    createdByUserId: req.user.uid || 'system'
                }
            });

            await transaction.save();
            await ensureReceiptNumber(transaction, orgId);
            automaticallyCreatedTransaction = transaction;
        }

        await pledge.populate([
            { path: 'memberId', select: 'fullName memberNumber' },
            { path: 'householdId', select: 'houseName houseNumber' },
            { path: 'careOfMemberId', select: 'fullName memberNumber' }
        ]);

        logger.info('Pledge updated', { pledgeId: pledge._id, fundraiserId, organizationId: orgId, generatedTransaction: !!automaticallyCreatedTransaction });

        res.json({ success: true, data: pledge, transaction: automaticallyCreatedTransaction });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /organizations/:orgId/fundraisers/:fundraiserId/pledges/:pledgeId
 */
exports.deletePledge = async (req, res, next) => {
    try {
        const { orgId, fundraiserId, pledgeId } = req.params;

        const pledge = await Sponsor.findOne({ _id: pledgeId, fundraiserId, organizationId: orgId, isDeleted: false });
        if (!pledge) throw new NotFoundError('Pledge not found');

        pledge.isDeleted = true;
        pledge.deletedAt = new Date();
        await pledge.save();

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /organizations/:orgId/fundraisers/:fundraiserId/pledges/:pledgeId/void
 */
exports.voidPledge = async (req, res, next) => {
    try {
        const { orgId, fundraiserId, pledgeId } = req.params;
        const { reason } = req.body;

        if (!reason || !reason.trim()) {
            throw new ValidationError('A void reason is required');
        }

        const pledge = await Sponsor.findOne({ _id: pledgeId, fundraiserId, organizationId: orgId, isDeleted: false });
        if (!pledge) throw new NotFoundError('Pledge not found');
        if (pledge.status === 'voided') throw new ValidationError('Pledge is already voided');

        pledge.status = 'voided';
        pledge.voidReason = reason.trim();
        pledge.voidedAt = new Date();
        pledge.voidedByUserId = req.user.uid;

        await pledge.save();

        // Void matching transactions
        await Transaction.updateMany(
            {
                organizationId: orgId,
                sourceType: 'fundraiser',
                sourceId: fundraiserId,
                amount: pledge.amount,
                'audit.isDeleted': false,
                status: { $in: ['completed', 'pending'] },
                // Add more matching logic if needed (e.g. memberId check)
            },
            {
                $set: {
                    status: 'voided',
                    voidReason: `Auto-voided because Pledge was voided: ${reason.trim()}`,
                    voidedAt: new Date(),
                    voidedByUserId: req.user.uid
                }
            }
        );

        logger.info('Pledge voided', { pledgeId: pledge._id, fundraiserId, organizationId: orgId });

        res.json({ success: true, data: pledge });
    } catch (error) {
        next(error);
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// FUNDRAISER TRANSACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /organizations/:orgId/fundraisers/:fundraiserId/transactions
 */
exports.listFundraiserTransactions = async (req, res, next) => {
    try {
        const { orgId, fundraiserId } = req.params;
        const { page, limit, status } = req.query;
        const { page: p, limit: l, skip } = paginate(page, limit);

        const fundraiser = await Fundraiser.findOne({ _id: fundraiserId, organizationId: orgId, isDeleted: false }).select('_id');
        if (!fundraiser) throw new NotFoundError('Fundraiser not found');

        const filter = {
            ...req.tenantFilter,
            sourceType: 'fundraiser',
            sourceId: fundraiserId,
            'audit.isDeleted': false
        };

        if (status) {
            filter.status = status;
        } else {
            filter.status = { $ne: 'voided' };
        }

        const [transactions, total] = await Promise.all([
            Transaction.find(filter)
                .populate('categoryId', 'name color')
                .populate('memberId', 'fullName memberNumber')
                .sort({ date: -1 })
                .skip(skip)
                .limit(l),
            Transaction.countDocuments(filter)
        ]);

        res.json({
            success: true,
            data: transactions,
            pagination: { page: p, limit: l, total, pages: Math.ceil(total / l) }
        });
    } catch (error) {
        next(error);
    }
};
/**
 * POST /organizations/:orgId/fundraisers/:fundraiserId/transactions
 */
exports.addFundraiserTransaction = async (req, res, next) => {
    try {
        const { orgId, fundraiserId } = req.params;
        const {
            type, amount, date, description, status,
            categoryId, memberId, householdId,
            payment
        } = req.body;

        if (!type || !amount) {
            throw new ValidationError('Transaction type and amount are required');
        }

        const fundraiser = await Fundraiser.findOne({ _id: fundraiserId, organizationId: orgId, isDeleted: false });
        if (!fundraiser) throw new NotFoundError('Fundraiser not found');

        const transaction = new Transaction({
            organizationId: orgId,
            sourceType: 'fundraiser',
            sourceId: fundraiserId,
            type,
            amount: Number(amount),
            currency: fundraiser.currency || 'INR',
            date: date || new Date(),
            description: description || `Fundraiser ${type}`,
            status: status || 'completed',
            categoryId: categoryId || null,
            memberId: memberId || null,
            householdId: householdId || null,
            payment: {
                method: payment?.method || 'cash',
                referenceNumber: payment?.referenceNumber || null,
                notes: payment?.notes || null
            },
            audit: {
                createdByUserId: req.user.uid
            }
        });

        await transaction.save();
        await ensureReceiptNumber(transaction, orgId);

        logger.info('Fundraiser transaction added', { transactionId: transaction._id, fundraiserId, type });

        res.status(201).json({ success: true, data: transaction });
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /organizations/:orgId/fundraisers/:fundraiserId/transactions/:txId
 */
exports.updateFundraiserTransaction = async (req, res, next) => {
    try {
        const { orgId, fundraiserId, txId } = req.params;
        const updates = req.body;

        const transaction = await Transaction.findOne({
            _id: txId,
            organizationId: orgId,
            sourceType: 'fundraiser',
            sourceId: fundraiserId,
            'audit.isDeleted': false
        });

        if (!transaction) throw new NotFoundError('Transaction not found');
        if (transaction.status === 'voided') throw new ValidationError('Cannot edit a voided transaction');

        // Update allowed fields
        const allowedFields = ['amount', 'date', 'description', 'status', 'categoryId', 'payment', 'notes'];
        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                transaction[field] = updates[field];
            }
        });

        transaction.audit.updatedAt = new Date();
        transaction.audit.updatedByUserId = req.user.uid;

        await transaction.save();
        await ensureReceiptNumber(transaction, orgId);

        res.json({ success: true, data: transaction });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /organizations/:orgId/fundraisers/:fundraiserId/transactions/:txId
 */
exports.deleteFundraiserTransaction = async (req, res, next) => {
    try {
        const { orgId, fundraiserId, txId } = req.params;

        const transaction = await Transaction.findOne({
            _id: txId,
            organizationId: orgId,
            sourceType: 'fundraiser',
            sourceId: fundraiserId,
            'audit.isDeleted': false
        });

        if (!transaction) throw new NotFoundError('Transaction not found');

        transaction.audit.isDeleted = true;
        transaction.audit.deletedAt = new Date();
        transaction.audit.deletedByUserId = req.user.uid;

        await transaction.save();

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /organizations/:orgId/fundraisers/:fundraiserId/transactions/:txId/void
 */
exports.voidFundraiserTransaction = async (req, res, next) => {
    try {
        const { orgId, fundraiserId, txId } = req.params;
        const { reason } = req.body;

        if (!reason || !reason.trim()) {
            throw new ValidationError('Void reason is required');
        }

        const transaction = await Transaction.findOne({
            _id: txId,
            organizationId: orgId,
            sourceType: 'fundraiser',
            sourceId: fundraiserId,
            'audit.isDeleted': false
        });

        if (!transaction) throw new NotFoundError('Transaction not found');
        if (transaction.status === 'voided') throw new ValidationError('Transaction is already voided');

        // Use the model's voidTransaction method if it exists, or update manually
        if (typeof transaction.voidTransaction === 'function') {
            await transaction.voidTransaction(req.user.uid, reason);
        } else {
            transaction.status = 'voided';
            transaction.voidReason = reason;
            transaction.voidedAt = new Date();
            transaction.voidedByUserId = req.user.uid;
            await transaction.save();
        }

        res.json({ success: true, data: transaction });
    } catch (error) {
        next(error);
    }
};

