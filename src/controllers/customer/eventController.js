const mongoose = require('mongoose');
const Event = require('../../models/Event');
const Fundraiser = require('../../models/Fundraiser');
const Sponsor = require('../../models/Sponsor');
const Transaction = require('../../models/Transaction');
const Member = require('../../models/Member');
const { NotFoundError, ValidationError } = require('../../utils/errors');
const logger = require('../../utils/logger');

/**
 * GET /customer/events
 * Fetch all active/upcoming events and fundraisers for the member's organization.
 */
exports.getActiveEvents = async (req, res, next) => {
    try {
        const { orgId } = req.user;

        const [events, fundraisers] = await Promise.all([
            Event.find({
                organizationId: orgId,
                status: { $in: ['upcoming', 'ongoing'] },
                isDeleted: false,
                startDate: { $gte: new Date(new Date().setDate(new Date().getDate() - 1)) } // Show events from today onwards
            }).sort({ startDate: 1 }).lean(),

            Fundraiser.find({
                organizationId: orgId,
                status: 'active',
                isDeleted: false
            }).sort({ createdAt: -1 }).lean()
        ]);

        // Standardize for frontend
        const standardized = [
            ...events.map(e => ({
                id: e._id,
                type: 'event',
                name: e.name,
                description: e.description,
                startDate: e.startDate,
                endDate: e.endDate,
                location: e.location,
                currency: e.currency || 'INR',
                upiAddress: e.upiAddress
            })),
            ...fundraisers.map(f => ({
                id: f._id,
                type: 'fundraiser',
                name: f.name,
                description: f.description,
                goalAmount: f.goalAmount,
                currency: f.currency || 'INR',
                startDate: f.startDate,
                endDate: f.endDate,
                status: f.status,
                upiAddress: f.upiAddress
            }))
        ];

        // Fetch progress for fundraisers
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

        const finalData = standardized.map(item => {
            if (item.type === 'fundraiser') {
                return {
                    ...item,
                    raisedAmount: progressMap[item.id.toString()] || 0
                };
            }
            return item;
        });

        res.json({ success: true, data: finalData });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /customer/events/:id/pledge
 * Create a pledge (Sponsor record) for an event or fundraiser.
 */
exports.pledgeEvent = async (req, res, next) => {
    try {
        const { orgId, uid, householdId } = req.user;
        const { id } = req.params;
        const { amount, notes, sponsorType, targetMemberId } = req.body; 

        console.log('[Pledge] Starting pledge creation', { orgId, uid, householdId, id, amount, sponsorType, targetMemberId });

        if (!amount || amount <= 0) {
            throw new ValidationError('Donation amount must be greater than 0');
        }

        if (!['member', 'household'].includes(sponsorType)) {
            throw new ValidationError('Invalid donation type. Must be "member" or "household"');
        }

        // 1. Identify what we are donating for (Event or Fundraiser)
        let event = await Event.findOne({ _id: id, organizationId: orgId, isDeleted: false });
        let fundraiser = null;
        
        if (!event) {
            fundraiser = await Fundraiser.findOne({ _id: id, organizationId: orgId, isDeleted: false });
        }

        console.log('[Pledge] Source check:', { foundEvent: !!event, foundFundraiser: !!fundraiser });

        if (!event && !fundraiser) {
            throw new NotFoundError('Event or Fundraiser not found');
        }

        // 2. Identify the member record
        let finalMemberId = null;
        if (sponsorType === 'member') {
            if (targetMemberId) {
                console.log('[Pledge] Targeting specific member:', targetMemberId);
                // If target member provided, ensure they belong to the same household
                const targetMember = await Member.findOne({ 
                  _id: new mongoose.Types.ObjectId(targetMemberId), 
                  organizationId: new mongoose.Types.ObjectId(orgId), 
                  currentHouseholdId: householdId ? new mongoose.Types.ObjectId(householdId) : null,
                  isDeleted: false 
                }).select('_id');
                
                if (!targetMember) {
                  throw new ValidationError('Selected member not found in your household');
                }
                finalMemberId = targetMember._id;
            } else {
                console.log('[Pledge] Fallback to current user member record:', uid);
                // Fallback to the logged-in user
                const member = await Member.findOne({ userId: uid, organizationId: orgId }).select('_id');
                if (!member) throw new NotFoundError('Member record not found');
                finalMemberId = member._id;
            }
        }

        // 3. Create the Sponsor record
        console.log('[Pledge] Creating sponsor record with:', { finalMemberId, householdId: sponsorType === 'household' ? householdId : null });
        const pledge = new Sponsor({
            organizationId: orgId,
            eventId: event ? event._id : null,
            fundraiserId: fundraiser ? fundraiser._id : null,
            sponsorType: sponsorType,
            memberId: finalMemberId,
            householdId: sponsorType === 'household' ? householdId : null,
            amount: Number(amount),
            currency: (event || fundraiser).currency || 'INR',
            type: 'cash',
            status: 'pending',
            notes: notes || null,
            entrySource: 'member',
            createdByUserId: uid
        });

        await pledge.save();

        logger.info('Customer pledge created', { 
            pledgeId: pledge._id, 
            sourceId: id, 
            memberId: finalMemberId,
            householdId: householdId,
            type: sponsorType 
        });

        res.status(201).json({ 
            success: true, 
            data: pledge,
            message: 'Donation recorded successfully. Please contact the administrator for payment confirmation.'
        });
    } catch (error) {
        console.error('[Pledge] Error in pledgeEvent:', error);
        next(error);
    }
};
