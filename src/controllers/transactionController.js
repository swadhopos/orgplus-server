const Transaction = require('../models/Transaction');
const Organization = require('../models/Organization');
const OrgConfig = require('../models/OrgConfig');
const Event = require('../models/Event');
const FeePlan = require('../models/FeePlan');
const { generateReceiptNumber } = require('../services/receiptNumberService');

/**
 * ensureReceiptNumber — Auto-generate a receipt number for a completed income transaction.
 * Safe to call on every save: returns immediately if already present or not applicable.
 * @param {Object} transaction - Mongoose transaction document (already saved)
 * @param {String} orgId - Organization ID string
 */
async function ensureReceiptNumber(transaction, orgId) {
    try {
        // Only generate for income/invoice transactions that are completed
        if (transaction.receiptNumber) return;
        if (transaction.status !== 'completed') return;
        if (!['income', 'invoice'].includes(transaction.type)) return;

        const [org, orgConfig] = await Promise.all([
            Organization.findByIdActive(orgId),
            OrgConfig.findOne({ organizationId: orgId })
        ]);

        if (!org || !orgConfig) return;

        let sourceDoc = null;
        if (transaction.sourceType === 'event') {
            sourceDoc = await Event.findById(transaction.sourceId).select('eventSequence').lean();
        } else if (transaction.sourceType === 'subscription') {
            const Subscription = require('../models/Subscription');
            const sub = await Subscription.findById(transaction.sourceId).lean();
            if (sub) {
                sourceDoc = await FeePlan.findById(sub.planId).select('planSequence').lean();
            }
        }

        await generateReceiptNumber(transaction, org, orgConfig, sourceDoc);
    } catch (err) {
        // Non-fatal — log but don't fail the parent request
        console.error('[ensureReceiptNumber] Failed silently:', err.message);
    }
}

exports.ensureReceiptNumber = ensureReceiptNumber;

exports.generateReceipt = async (req, res, next) => {
    try {
        const { orgId, txId } = req.params;

        const transaction = await Transaction.findOne({ _id: txId, organizationId: orgId, 'audit.isDeleted': false });
        if (!transaction) {
            return res.status(404).json({ success: false, error: { message: 'Transaction not found' } });
        }

        // Idempotency check
        if (transaction.receiptNumber) {
            return res.status(200).json({ success: true, data: { receiptNumber: transaction.receiptNumber } });
        }

        const org = await Organization.findByIdActive(orgId);
        if (!org) {
            return res.status(404).json({ success: false, error: { message: 'Organization not found' } });
        }

        const orgConfig = await OrgConfig.findOne({ organizationId: orgId });
        if (!orgConfig) {
            return res.status(404).json({ success: false, error: { message: 'Organization configuration not found' } });
        }

        let sourceDoc = null;
        if (transaction.sourceType === 'event') {
            sourceDoc = await Event.findById(transaction.sourceId);
        } else if (transaction.sourceType === 'subscription' || transaction.sourceType === 'fee') {
            // Depending on how subscription plan is linked (sometimes directly linked to FeePlan or via Subscription)
            // Let's check sourceId. Assume transaction.sourceId is the plan ID or the event ID. Wait, for subscription, transaction.sourceId is the Subscription ID, not the FeePlan ID!
            // Let's actually find the Subscription first and then get the plan.
            const Subscription = require('../models/Subscription');
            const sub = await Subscription.findById(transaction.sourceId);
            if (sub) {
                sourceDoc = await FeePlan.findById(sub.planId);
            }
        }

        const receiptNumber = await generateReceiptNumber(transaction, org, orgConfig, sourceDoc);

        res.status(200).json({
            success: true,
            data: { receiptNumber }
        });
    } catch (error) {
        console.error('Error generating receipt number:', error);
        next(error);
    }
};

exports.getTransaction = async (req, res, next) => {
    try {
        const { orgId, txId } = req.params;
        const transaction = await Transaction.findOne({ _id: txId, organizationId: orgId, 'audit.isDeleted': false })
            .populate('categoryId', 'name type _id')
            .populate('memberId', 'fullName memberNumber _id')
            .populate('householdId', 'houseName houseNumber _id')
            .lean();

        if (!transaction) {
            return res.status(404).json({ success: false, error: { message: 'Transaction not found' } });
        }
        
        const org = await Organization.findById(orgId).select('name orgNumber address contactEmail contactPhone').lean();

        let sourceEntityLabel = null;
        if (transaction.sourceType === 'event') {
            const evt = await Event.findById(transaction.sourceId).select('name').lean();
            if (evt) sourceEntityLabel = evt.name;
        } else if (transaction.sourceType === 'subscription') {
            const Subscription = require('../models/Subscription');
            const sub = await Subscription.findById(transaction.sourceId).lean();
            if (sub) {
                const plan = await FeePlan.findById(sub.planId).select('name').lean();
                if (plan) sourceEntityLabel = plan.name;
            }
        }

        res.status(200).json({
            success: true,
            data: {
                transaction,
                organization: org,
                sourceEntityLabel
            }
        });

    } catch (error) {
        next(error);
    }
};
