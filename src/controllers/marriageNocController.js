const MarriageNOC = require('../models/MarriageNOC');
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

// @desc    Get all marriage NOCs for an organization
// @route   GET /api/organizations/:orgId/certificates/noc
exports.getNOCs = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { status } = req.query;
        const filter = { organizationId: orgId };
        if (status) filter.status = status;

        const nocs = await MarriageNOC.find(filter)
            .populate('memberId', 'fullName mobileNumber gender memberNumber')
            .populate('approvals.memberId', 'fullName')
            .sort({ createdAt: -1 });

        res.status(200).json(nocs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// @desc    Create a new Marriage NOC (status: pending, awaiting committee approval)
// @route   POST /api/organizations/:orgId/certificates/noc
exports.createNOC = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { memberId, fianceDetails, notes } = req.body;

        // Check member exists
        const member = await Member.findById(memberId);
        if (!member) return res.status(404).json({ error: 'Member not found' });

        // Atomically generate a unique, human-readable certificate number
        const certificateNumber = await generateCertNumber(orgId, 'NOC');

        const newNoc = new MarriageNOC({
            organizationId: orgId,
            memberId,
            certificateNumber,
            fianceDetails,
            notes,
            status: 'pending',       // awaits committee approvals
            issueDate: null,
            issuedByUserId: req.user.id
        });

        await newNoc.save();

        const populated = await MarriageNOC.findById(newNoc._id)
            .populate('memberId', 'fullName mobileNumber gender memberNumber');

        res.status(201).json(populated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// @desc    Approve a Marriage NOC (committee member casts vote)
// @route   POST /api/organizations/:orgId/certificates/noc/:id/approve
exports.approveNOC = async (req, res) => {
    try {
        const { orgId, id } = req.params;
        const { notes } = req.body;

        const noc = await MarriageNOC.findOne({ _id: id, organizationId: orgId });
        if (!noc) return res.status(404).json({ error: 'NOC not found' });
        if (noc.status !== 'pending') return res.status(400).json({ error: `NOC is already ${noc.status}` });

        // Validate approver
        let approverInfo;
        try {
            approverInfo = await validateApprover(orgId, req.user.uid, req.user.memberId);
        } catch (e) {
            return res.status(403).json({ error: e.message });
        }

        const { committeeMember, member, requiredApprovals } = approverInfo;

        // Prevent duplicate approvals
        const alreadyApproved = noc.approvals.some(
            a => a.committeeMemberId.toString() === committeeMember._id.toString()
        );
        if (alreadyApproved) return res.status(400).json({ error: 'You have already approved this NOC' });

        noc.approvals.push({
            committeeMemberId: committeeMember._id,
            memberId: member._id,
            approvedAt: new Date(),
            notes
        });

        if (noc.approvals.length >= requiredApprovals) {
            noc.status = 'issued';
            noc.issueDate = new Date();
        }

        await noc.save();

        const populated = await MarriageNOC.findById(noc._id)
            .populate('memberId', 'fullName mobileNumber gender memberNumber')
            .populate('approvals.memberId', 'fullName');

        res.json(populated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// @desc    Revoke a Marriage NOC
// @route   PUT /api/organizations/:orgId/certificates/noc/:id/status
exports.updateNOCStatus = async (req, res) => {
    try {
        const { orgId, id } = req.params;
        const { status } = req.body;

        if (!['revoked'].includes(status)) {
            return res.status(400).json({ error: 'Only revocation is supported via this endpoint' });
        }

        const noc = await MarriageNOC.findOneAndUpdate(
            { _id: id, organizationId: orgId },
            { status },
            { new: true }
        ).populate('memberId', 'fullName mobileNumber gender memberNumber');

        if (!noc) return res.status(404).json({ error: 'Certificate not found' });

        res.status(200).json(noc);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
