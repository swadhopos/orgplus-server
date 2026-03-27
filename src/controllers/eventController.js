const mongoose = require('mongoose');
const Event = require('../models/Event');
const Sponsor = require('../models/Sponsor');
const Committee = require('../models/Committee');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const Counter = require('../models/Counter');
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
// EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /organizations/:orgId/events
 * Create an event
 */
exports.createEvent = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const { name, description, type, status, startDate, endDate, location, budget, currency } = req.body;

        if (!name || !startDate) {
            throw new ValidationError('Missing required fields: name, startDate');
        }

        const seq = await Counter.getNextSequence(orgId, 'event', 'eventSequence');

        const event = new Event({
            organizationId: orgId,
            eventSequence: seq,
            name,
            description: description || null,
            type: type || 'general',
            status: status || 'upcoming',
            startDate,
            endDate: endDate || null,
            location: location || null,
            budget: budget != null ? Number(budget) : null,
            currency: currency || 'INR',
            createdByUserId: req.user.uid
        });

        await event.save();

        logger.info('Event created', { eventId: event._id, organizationId: orgId, createdBy: req.user.uid });

        res.status(201).json({ success: true, data: event });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /organizations/:orgId/events
 * List events (paginated, with optional status/type filters)
 */
exports.listEvents = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const { page, limit, status, type, search } = req.query;
        const { page: p, limit: l, skip } = paginate(page, limit);

        const filter = { organizationId: orgId, isDeleted: false };
        if (status) filter.status = status;
        if (type) filter.type = type;
        if (search) filter.name = { $regex: search, $options: 'i' };

        const [events, total] = await Promise.all([
            Event.find(filter).sort({ startDate: -1 }).skip(skip).limit(l),
            Event.countDocuments(filter)
        ]);

        res.json({
            success: true,
            data: events,
            pagination: { page: p, limit: l, total, pages: Math.ceil(total / l) }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /organizations/:orgId/events/:id
 * Get single event (with summary counts)
 */
exports.getEvent = async (req, res, next) => {
    try {
        const { orgId, id } = req.params;

        const event = await Event.findOne({ _id: id, organizationId: orgId, isDeleted: false });
        if (!event) throw new NotFoundError('Event not found');

        // Lightweight counts for dashboard use
        const [sponsorCount, txCount, committee, txStats, sponsorStats] = await Promise.all([
            Sponsor.countDocuments({ eventId: id, isDeleted: false }),
            Transaction.countDocuments({ organizationId: orgId, sourceType: 'event', sourceId: id, 'audit.isDeleted': false }),
            Committee.findOne({ eventId: id, organizationId: orgId, isDeleted: false }).select('_id name type status'),
            Transaction.aggregate([
                { $match: { organizationId: new mongoose.Types.ObjectId(orgId), sourceType: 'event', sourceId: new mongoose.Types.ObjectId(id), 'audit.isDeleted': false, status: { $ne: 'voided' } } },
                { $group: { _id: '$type', total: { $sum: '$amount' } } }
            ]),
            Sponsor.aggregate([
                { $match: { eventId: new mongoose.Types.ObjectId(id), isDeleted: false, status: { $in: ['confirmed', 'pending'] } } },
                { $group: { _id: null, totalCollected: { $sum: '$amount' } } }
            ])
        ]);

        let totalIncome = 0;
        let totalExpense = 0;
        txStats.forEach(stat => {
            if (stat._id === 'income') totalIncome = stat.total;
            if (stat._id === 'expense') totalExpense = stat.total;
        });

        const totalSponsorship = sponsorStats[0]?.totalCollected || 0;

        res.json({
            success: true,
            data: {
                ...event.toObject(),
                _counts: { sponsors: sponsorCount, transactions: txCount },
                _totals: { income: totalIncome, expense: totalExpense, sponsorship: totalSponsorship },
                committee: committee || null
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /organizations/:orgId/events/:id
 * Update event
 */
exports.updateEvent = async (req, res, next) => {
    try {
        const { orgId, id } = req.params;
        const { name, description, type, status, startDate, endDate, location, budget, currency, committeeId } = req.body;

        const event = await Event.findOne({ _id: id, organizationId: orgId, isDeleted: false });
        if (!event) throw new NotFoundError('Event not found');

        if (name !== undefined) event.name = name;
        if (description !== undefined) event.description = description;
        if (type !== undefined) event.type = type;
        if (status !== undefined) event.status = status;
        if (startDate !== undefined) event.startDate = startDate;
        if (endDate !== undefined) event.endDate = endDate;
        if (location !== undefined) event.location = location;
        if (budget !== undefined) event.budget = budget != null ? Number(budget) : null;
        if (currency !== undefined) event.currency = currency;
        if (committeeId !== undefined) event.committeeId = committeeId;

        await event.save();

        logger.info('Event updated', { eventId: event._id, organizationId: orgId, updatedBy: req.user.uid });

        res.json({ success: true, data: event });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /organizations/:orgId/events/:id
 * Soft delete event
 */
exports.deleteEvent = async (req, res, next) => {
    try {
        const { orgId, id } = req.params;

        const event = await Event.findOne({ _id: id, organizationId: orgId, isDeleted: false });
        if (!event) throw new NotFoundError('Event not found');

        event.isDeleted = true;
        event.deletedAt = new Date();
        // Custom field to say deletedBy? Keep custom audit standard
        event.updatedAt = new Date();
        await event.save();

        logger.info('Event deleted', { eventId: id, organizationId: orgId, deletedBy: req.user.uid });

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// SPONSORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /organizations/:orgId/events/:eventId/sponsors
 */
exports.listSponsors = async (req, res, next) => {
    try {
        const { orgId, eventId } = req.params;
        const { page, limit, status } = req.query;
        const { page: p, limit: l, skip } = paginate(page, limit);

        const event = await Event.findOne({ _id: eventId, organizationId: orgId, isDeleted: false }).select('_id');
        if (!event) throw new NotFoundError('Event not found');

        const filter = { eventId, organizationId: orgId, isDeleted: false };
        if (status) filter.status = status;

        const [sponsors, total] = await Promise.all([
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
            data: sponsors,
            pagination: { page: p, limit: l, total, pages: Math.ceil(total / l) }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /organizations/:orgId/events/:eventId/sponsors
 */
exports.createSponsor = async (req, res, next) => {
    try {
        const { orgId, eventId } = req.params;
        const {
            sponsorType, memberId, householdId, externalName, careOfMemberId,
            contactPerson, contactPhone, contactEmail,
            amount, type, status, notes
        } = req.body;

        if (!sponsorType || amount == null) {
            throw new ValidationError('Missing required fields: sponsorType, amount');
        }

        // Validate sponsorType
        if (sponsorType === 'member' && !memberId) {
            throw new ValidationError('memberId is required for member sponsor type');
        }
        if (sponsorType === 'household' && !householdId) {
            throw new ValidationError('householdId is required for household sponsor type');
        }
        if (sponsorType === 'external' && !externalName) {
            throw new ValidationError('externalName is required for external sponsor type');
        }

        const event = await Event.findOne({ _id: eventId, organizationId: orgId, isDeleted: false }).select('currency');
        if (!event) throw new NotFoundError('Event not found');

        const sponsor = new Sponsor({
            organizationId: orgId,
            eventId,
            sponsorType,
            memberId: sponsorType === 'member' ? memberId : null,
            householdId: sponsorType === 'household' ? householdId : null,
            externalName: sponsorType === 'external' ? externalName : null,
            careOfMemberId: sponsorType === 'external' ? (careOfMemberId || null) : null,
            contactPerson: contactPerson || null,
            contactPhone: contactPhone || null,
            contactEmail: contactEmail || null,
            amount: Number(amount),
            currency: event.currency || 'INR',
            type: type || 'cash',
            status: status || 'pending',
            notes: notes || null,
            createdByUserId: req.user.uid
        });

        await sponsor.save();

        const { createTransaction, paymentMethod, referenceNumber } = req.body;
        let automaticallyCreatedTransaction = null;
        if (createTransaction && sponsor.status === 'confirmed' && sponsor.type === 'cash') {
            const transaction = new Transaction({
                organizationId: orgId,
                sourceType: 'event',
                sourceId: eventId,
                type: 'income',
                amount: sponsor.amount,
                currency: sponsor.currency || 'INR',
                date: new Date(),
                description: `Sponsorship Payment - ${sponsor.sponsorType === 'member' ? 'Member' :
                    sponsor.sponsorType === 'household' ? 'Household' : sponsor.externalName || 'External'
                    }`,
                memberId: sponsor.sponsorType === 'member' ? sponsor.memberId : null,
                householdId: sponsor.sponsorType === 'household' ? sponsor.householdId : null,
                payment: {
                    method: paymentMethod || 'cash',
                    referenceNumber: referenceNumber || null,
                    notes: 'Automatically generated from sponsor creation'
                },
                status: 'completed',
                audit: {
                    createdByUserId: req.user.uid || 'system'
                }
            });

            await transaction.save();
            automaticallyCreatedTransaction = transaction;
        }

        await sponsor.populate([
            { path: 'memberId', select: 'fullName memberNumber' },
            { path: 'householdId', select: 'houseName houseNumber' },
            { path: 'careOfMemberId', select: 'fullName memberNumber' }
        ]);

        logger.info('Sponsor created', { sponsorId: sponsor._id, eventId, organizationId: orgId, generatedTransaction: !!automaticallyCreatedTransaction });

        res.status(201).json({ success: true, data: sponsor });
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /organizations/:orgId/events/:eventId/sponsors/:sponsorId
 */
exports.updateSponsor = async (req, res, next) => {
    try {
        const { orgId, eventId, sponsorId } = req.params;
        const {
            sponsorType, memberId, householdId, externalName, careOfMemberId,
            contactPerson, contactPhone, contactEmail,
            amount, type, status, notes
        } = req.body;

        const sponsor = await Sponsor.findOne({ _id: sponsorId, eventId, organizationId: orgId, isDeleted: false });
        if (!sponsor) throw new NotFoundError('Sponsor not found');

        // Prevent modification of voided sponsors
        if (sponsor.status === 'voided') {
            throw new ValidationError('Cannot edit a voided sponsor. Please create a new one instead.');
        }

        // Lock down confirmed sponsors (unless returning them to pending)
        const isCurrentlyConfirmed = sponsor.status === 'confirmed';
        const isSwitchingToPending = status === 'pending';
        if (isCurrentlyConfirmed && !isSwitchingToPending) {
            // Only allow contact info + notes edits if confirmed
            if (amount !== undefined && amount !== sponsor.amount) throw new ValidationError('Cannot edit amount of a confirmed sponsor. Please void and recreate if necessary.');
            if (sponsorType !== undefined && sponsorType !== sponsor.sponsorType) throw new ValidationError('Cannot change sponsor type of a confirmed sponsor.');
            if (type !== undefined && type !== sponsor.type) throw new ValidationError('Cannot edit contribution type of a confirmed sponsor.');
        }

        // Allow sponsor type switching (e.g. member -> household)
        if (sponsorType !== undefined) {
            sponsor.sponsorType = sponsorType;

            if (sponsorType === 'member') {
                if (memberId) sponsor.memberId = memberId;
                sponsor.householdId = null;
                sponsor.externalName = null;
                sponsor.careOfMemberId = null;
            } else if (sponsorType === 'household') {
                if (householdId) sponsor.householdId = householdId;
                sponsor.memberId = null;
                sponsor.externalName = null;
                sponsor.careOfMemberId = null;
            } else if (sponsorType === 'external') {
                if (externalName) sponsor.externalName = externalName;
                if (careOfMemberId !== undefined) sponsor.careOfMemberId = careOfMemberId;
                sponsor.memberId = null;
                sponsor.householdId = null;
            }
        } else {
            // If type not changed, still allow updates to individual fields if they match current type
            if (sponsor.sponsorType === 'member' && memberId !== undefined) sponsor.memberId = memberId;
            if (sponsor.sponsorType === 'household' && householdId !== undefined) sponsor.householdId = householdId;
            if (sponsor.sponsorType === 'external') {
                if (externalName !== undefined) sponsor.externalName = externalName;
                if (careOfMemberId !== undefined) sponsor.careOfMemberId = careOfMemberId;
            }
        }

        if (contactPerson !== undefined) sponsor.contactPerson = contactPerson;
        if (contactPhone !== undefined) sponsor.contactPhone = contactPhone;
        if (contactEmail !== undefined) sponsor.contactEmail = contactEmail;
        if (amount !== undefined) sponsor.amount = Number(amount);
        if (type !== undefined) sponsor.type = type;
        if (status !== undefined) sponsor.status = status;
        if (notes !== undefined) sponsor.notes = notes;

        // Remember old status to prevent creating multiple transactions if they spam update
        const oldStatus = sponsor.status;

        await sponsor.save();

        const { createTransaction, paymentMethod, referenceNumber } = req.body;
        let automaticallyCreatedTransaction = null;

        // Only create if we are now confirming, we weren't confirmed before (or this is explictly requested), and it's cash
        if (createTransaction && sponsor.status === 'confirmed' && sponsor.type === 'cash') {
            const transaction = new Transaction({
                organizationId: orgId,
                sourceType: 'event',
                sourceId: eventId,
                type: 'income',
                amount: sponsor.amount,
                currency: sponsor.currency || 'INR',
                date: new Date(),
                description: `Sponsorship Payment - ${sponsor.sponsorType === 'member' ? 'Member' :
                    sponsor.sponsorType === 'household' ? 'Household' : sponsor.externalName || 'External'
                    }`,
                memberId: sponsor.sponsorType === 'member' ? sponsor.memberId : null,
                householdId: sponsor.sponsorType === 'household' ? sponsor.householdId : null,
                payment: {
                    method: paymentMethod || 'cash',
                    referenceNumber: referenceNumber || null,
                    notes: 'Automatically generated from sponsor payment'
                },
                status: 'completed',
                audit: {
                    createdByUserId: req.user.uid || 'system'
                }
            });

            await transaction.save();
            automaticallyCreatedTransaction = transaction;
        }

        await sponsor.populate([
            { path: 'memberId', select: 'fullName memberNumber' },
            { path: 'householdId', select: 'houseName houseNumber' },
            { path: 'careOfMemberId', select: 'fullName memberNumber' }
        ]);

        logger.info('Sponsor updated', { sponsorId: sponsor._id, eventId, organizationId: orgId, generatedTransaction: !!automaticallyCreatedTransaction });

        res.json({ success: true, data: sponsor });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /organizations/:orgId/events/:eventId/sponsors/:sponsorId
 */
exports.deleteSponsor = async (req, res, next) => {
    try {
        const { orgId, eventId, sponsorId } = req.params;

        const sponsor = await Sponsor.findOne({ _id: sponsorId, eventId, organizationId: orgId, isDeleted: false });
        if (!sponsor) throw new NotFoundError('Sponsor not found');

        sponsor.isDeleted = true;
        sponsor.deletedAt = new Date();
        await sponsor.save();

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /organizations/:orgId/events/:eventId/sponsors/:sponsorId/void
 */
exports.voidSponsor = async (req, res, next) => {
    try {
        const { orgId, eventId, sponsorId } = req.params;
        const { reason } = req.body;

        if (!reason || !reason.trim()) {
            throw new ValidationError('A void reason is required');
        }

        const sponsor = await Sponsor.findOne({ _id: sponsorId, eventId, organizationId: orgId, isDeleted: false });
        if (!sponsor) throw new NotFoundError('Sponsor not found');
        if (sponsor.status === 'voided') {
            throw new ValidationError('Sponsor is already voided');
        }

        sponsor.status = 'voided';
        sponsor.voidReason = reason.trim();
        sponsor.voidedAt = new Date();
        sponsor.voidedByUserId = req.user.uid;

        await sponsor.save();

        // Also void any non-deleted transactions that match this exact description/source
        // This is a safety measure to clear the ledger automatically if it was generated
        const automaticDescriptionRegex = new RegExp(`Sponsorship Payment - `, 'i');
        const transactionsToVoid = await Transaction.find({
            organizationId: orgId,
            sourceType: 'event',
            sourceId: eventId,
            amount: sponsor.amount, // match amount
            description: automaticDescriptionRegex, // loosely matches
            'audit.isDeleted': false,
            status: { $in: ['completed', 'pending'] }
        });

        // We only want to void income transactions that belong to this member/household/external
        const txToVoid = transactionsToVoid.find(tx => {
            if (sponsor.sponsorType === 'member' && tx.memberId?.toString() === sponsor.memberId?.toString()) return true;
            if (sponsor.sponsorType === 'household' && tx.householdId?.toString() === sponsor.householdId?.toString()) return true;
            if (sponsor.sponsorType === 'external' && tx.description.includes(sponsor.externalName || 'External')) return true;
            return false;
        });

        if (txToVoid) {
            await txToVoid.voidTransaction(req.user.uid, `Auto-voided because Sponsor record was voided: ${reason.trim()}`);
        }

        logger.info('Sponsor voided', { sponsorId: sponsor._id, eventId, organizationId: orgId });

        res.json({ success: true, data: sponsor });
    } catch (error) {
        next(error);
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT TRANSACTIONS (read-only view of Transactions filtered by event)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /organizations/:orgId/events/:eventId/transactions
 */
exports.listEventTransactions = async (req, res, next) => {
    try {
        const { orgId, eventId } = req.params;
        const { page, limit } = req.query;
        const { page: p, limit: l, skip } = paginate(page, limit);

        const event = await Event.findOne({ _id: eventId, organizationId: orgId, isDeleted: false }).select('_id');
        if (!event) throw new NotFoundError('Event not found');

        const filter = {
            organizationId: orgId,
            sourceType: 'event',
            sourceId: eventId,
            'audit.isDeleted': false
        };

        if (req.query.status) {
            filter.status = req.query.status;
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
 * POST /organizations/:orgId/events/:eventId/transactions
 */
exports.addEventTransaction = async (req, res, next) => {
    try {
        const { orgId, eventId } = req.params;
        const {
            type, amount, date, description, status,
            categoryId, memberId, householdId,
            payment
        } = req.body;

        if (!type || !amount) {
            throw new ValidationError('Transaction type and amount are required');
        }
        if (memberId && householdId) {
            throw new ValidationError('A transaction can be linked to either a member or a household, not both');
        }

        const event = await Event.findOne({
            _id: eventId,
            organizationId: orgId,
            isDeleted: false
        });
        if (!event) throw new NotFoundError('Event not found');

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
            sourceType: 'event',
            sourceId: eventId,
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
        await ensureReceiptNumber(tx, orgId);

        logger.info('Transaction added to event', {
            transactionId: tx._id,
            eventId,
            organizationId: orgId,
            createdBy: req.user.uid
        });

        res.status(201).json({ success: true, data: tx });
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /organizations/:orgId/events/:eventId/transactions/:txId
 */
exports.updateEventTransaction = async (req, res, next) => {
    try {
        const { orgId, eventId, txId } = req.params;
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
            sourceType: 'event',
            sourceId: eventId,
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
        await ensureReceiptNumber(tx, orgId);

        res.json({ success: true, data: tx });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /organizations/:orgId/events/:eventId/transactions/:txId
 */
exports.deleteEventTransaction = async (req, res, next) => {
    try {
        const { orgId, eventId, txId } = req.params;
        const { reason } = req.body;

        const tx = await Transaction.findOne({
            _id: txId,
            organizationId: orgId,
            sourceType: 'event',
            sourceId: eventId,
            'audit.isDeleted': false
        });

        if (!tx) throw new NotFoundError('Transaction not found');

        await tx.softDelete(req.user.uid, reason || null);

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /organizations/:orgId/events/:eventId/transactions/:txId/void
 */
exports.voidEventTransaction = async (req, res, next) => {
    try {
        const { orgId, eventId, txId } = req.params;
        const { reason } = req.body;

        if (!reason || !reason.trim()) {
            throw new ValidationError('A void reason is required');
        }

        const tx = await Transaction.findOne({
            _id: txId,
            organizationId: orgId,
            sourceType: 'event',
            sourceId: eventId,
            'audit.isDeleted': false
        });

        if (!tx) throw new NotFoundError('Transaction not found');
        if (tx.status === 'voided') {
            throw new ValidationError('Transaction is already voided');
        }

        await tx.voidTransaction(req.user.uid, reason.trim());

        res.json({ success: true, data: tx });
    } catch (error) {
        next(error);
    }
};
