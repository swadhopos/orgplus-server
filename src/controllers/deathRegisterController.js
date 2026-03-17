const DeathRegister = require('../models/DeathRegister');
const Member = require('../models/Member');
const OrgSettings = require('../models/OrgSettings');
const CommitteeMember = require('../models/CommitteeMember');
const { generateCertNumber } = require('../utils/certNumber');

// ─── Helper: validate approver against org approval settings ─────────────────

async function validateApprover(orgId, userId, memberId) {
    const settings = await OrgSettings.findOne({ organizationId: orgId });
    const as = settings?.approvalSettings;

    if (!as?.approverCommitteeId) {
        throw new Error('No approval committee configured. Please set up approval settings first.');
    }

    // Find the Member record — prioritize memberId from claims, fallback to userId scan
    let memberRecord;
    if (memberId) {
        memberRecord = await Member.findById(memberId);
    } else {
        memberRecord = await Member.findOne({ userId, organizationId: orgId });
    }

    if (!memberRecord) throw new Error('You are not a registered member of this organisation.');

    const query = {
        committeeId: as.approverCommitteeId,
        memberId: memberRecord._id,
        status: 'active'
    };
    if (as.approverRoles?.length > 0) {
        query.role = { $in: as.approverRoles };
    }

    const cm = await CommitteeMember.findOne(query);
    if (!cm) throw new Error('You are not authorised to approve records (not an active member of the approval committee with the required role).');

    return { committeeMember: cm, member: memberRecord, requiredApprovals: as.requiredApprovals ?? 3 };
}

// @desc    Create a new death record
// @route   POST /api/organizations/:orgId/death
exports.createDeathRecord = async (req, res) => {
    try {
        const {
            organizationId, memberId, householdId,
            dateOfDeath, causeOfDeath, placeOfDeath,
            burialPlace, burialLocation, reportedBy,
            certificateNumber, officialCertificateUrl, notes
        } = req.body;

        // Guard: one death record per member
        const existingRecord = await DeathRegister.findOne({ memberId });
        if (existingRecord) {
            return res.status(400).json({ error: 'A death record already exists for this member' });
        }

        // Atomically generate a unique, human-readable certificate number
        const certNumber = await generateCertNumber(organizationId, 'DC');

        // Fetch member and household info for denormalization
        const member = await Member.findById(memberId).populate('currentHouseholdId');
        if (!member) return res.status(404).json({ error: 'Member not found' });
        
        const household = member.currentHouseholdId;

        const newRecord = new DeathRegister({
            organizationId,
            memberId,
            householdId: household?._id || householdId,
            memberFullName: member.fullName,
            memberNumber: member.memberNumber,
            householdNumber: household?.houseNumber || '',
            dateOfDeath,
            causeOfDeath,
            placeOfDeath,
            burialPlace,
            burialLocation,
            reportedBy,
            certificateNumber: certNumber,
            officialCertificateUrl,
            notes,
            status: 'pending',
            createdByUserId: req.user?._id || 'system'
        });

        await newRecord.save();
        res.status(201).json(newRecord);
    } catch (error) {
        console.error('Error creating death record:', error);
        res.status(500).json({ error: 'Failed to create death record' });
    }
};

// @desc    Get all death records for an organization
// @route   GET /api/organizations/:orgId/death
exports.getDeathRecords = async (req, res) => {
    try {
        const { organizationId, page = 1, limit = 20, search, status } = req.query;

        if (!organizationId) {
            return res.status(400).json({ error: 'organizationId query parameter is required' });
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const filter = { organizationId };
        
        if (status) filter.status = status;
        
        if (search) {
            filter.$or = [
                { memberFullName: { $regex: search, $options: 'i' } },
                { memberNumber: { $regex: search, $options: 'i' } },
                { householdNumber: { $regex: search, $options: 'i' } },
                { certificateNumber: { $regex: search, $options: 'i' } }
            ];
        }

        const [records, total] = await Promise.all([
            DeathRegister.find(filter)
                .populate('memberId', 'fullName mobileNumber gender memberNumber')
                .populate('householdId', 'name houseNumber')
                .populate('approvals.memberId', 'fullName')
                .sort({ dateOfDeath: -1, createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            DeathRegister.countDocuments(filter)
        ]);

        res.json({
            success: true,
            data: records,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching death records:', error);
        res.status(500).json({ error: 'Failed to fetch death records' });
    }
};

// @desc    Get a single death record by ID
// @route   GET /api/organizations/:orgId/death/:id
exports.getDeathRecordById = async (req, res) => {
    try {
        const record = await DeathRegister.findById(req.params.id)
            .populate('memberId')
            .populate('householdId');

        if (!record) return res.status(404).json({ error: 'Death record not found' });

        res.json(record);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch death record' });
    }
};

// @desc    Update a death record (non-status fields only)
// @route   PUT /api/organizations/:orgId/death/:id
exports.updateDeathRecord = async (req, res) => {
    try {
        const updateData = { ...req.body };
        delete updateData.status;
        delete updateData.verifiedByUserId;
        delete updateData.verifiedAt;
        delete updateData.approvals;

        const record = await DeathRegister.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!record) return res.status(404).json({ error: 'Death record not found' });

        res.json(record);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update death record' });
    }
};

// @desc    Approve a death record (committee member casts vote)
// @route   POST /api/organizations/:orgId/death/:id/approve
exports.approveDeath = async (req, res) => {
    try {
        const { orgId, id } = req.params;
        const { notes } = req.body;

        const record = await DeathRegister.findOne({ _id: id, organizationId: orgId });
        if (!record) return res.status(404).json({ error: 'Death record not found' });
        if (record.status !== 'pending') return res.status(400).json({ error: `Record is already ${record.status}` });

        // Validate approver
        let approverInfo;
        try {
            approverInfo = await validateApprover(orgId, req.user.uid, req.user.memberId);
        } catch (e) {
            return res.status(403).json({ error: e.message });
        }

        const { committeeMember, member, requiredApprovals } = approverInfo;

        // Prevent duplicate approvals
        const alreadyApproved = record.approvals.some(
            a => a.committeeMemberId.toString() === committeeMember._id.toString()
        );
        if (alreadyApproved) return res.status(400).json({ error: 'You have already approved this record' });

        record.approvals.push({
            committeeMemberId: committeeMember._id,
            memberId: member._id,
            approvedAt: new Date(),
            notes
        });

        if (record.approvals.length >= requiredApprovals) {
            record.status = 'verified';
            record.verifiedAt = new Date();
            record.verifiedByUserId = member._id.toString();

            // Cascade: mark member as deceased
            await Member.findByIdAndUpdate(record.memberId, {
                $set: {
                    isDeceased: true,
                    status: 'deceased',
                    deathDate: record.dateOfDeath,
                    deathCause: record.causeOfDeath
                }
            });
        }

        await record.save();

        const populated = await DeathRegister.findById(record._id)
            .populate('memberId', 'fullName mobileNumber gender')
            .populate('householdId', 'name householdNumber')
            .populate('approvals.memberId', 'fullName');

        res.json(populated);
    } catch (error) {
        console.error('approveDeath error:', error);
        res.status(500).json({ error: 'Failed to record approval' });
    }
};

// @desc    Reject a death record (admin action — no committee required)
// @route   PUT /api/organizations/:orgId/death/:id/status
exports.verifyDeathRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        if (!['rejected'].includes(status)) {
            return res.status(400).json({ error: 'Only rejection is allowed via this endpoint. Use /approve for verification.' });
        }

        const record = await DeathRegister.findById(id);
        if (!record) return res.status(404).json({ error: 'Death record not found' });

        if (record.status === 'verified') {
            return res.status(400).json({ error: 'Cannot reject an already verified record' });
        }

        record.status = status;
        if (notes) record.notes = notes;

        await record.save();

        const populated = await DeathRegister.findById(id)
            .populate('memberId')
            .populate('householdId');

        res.json(populated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update death record' });
    }
};

// @desc    Delete a death record (only if pending/rejected)
// @route   DELETE /api/organizations/:orgId/death/:id
exports.deleteDeathRecord = async (req, res) => {
    try {
        const record = await DeathRegister.findById(req.params.id);
        if (!record) return res.status(404).json({ error: 'Death record not found' });
        if (record.status === 'verified') {
            return res.status(400).json({ error: 'Cannot delete a verified death record' });
        }
        await DeathRegister.findByIdAndDelete(req.params.id);
        res.json({ message: 'Death record deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete death record' });
    }
};
