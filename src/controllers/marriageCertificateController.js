const MarriageCertificate = require('../models/MarriageCertificate');
const OrgSettings = require('../models/OrgSettings');
const Member = require('../models/Member');
const CommitteeMember = require('../models/CommitteeMember');
const Household = require('../models/Household');
const Organization = require('../models/Organization');
const { NotFoundError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');
const { autoAssignPlansToNewTarget } = require('../services/subscriptionService');
const { generateCertNumber } = require('../utils/certNumber');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Runs all member side-effects when a certificate becomes "issued".
 * Called atomically inside approveCertificate when approval threshold is met.
 */
async function applyMemberSideEffects(certificate, orgId, issuedByUserId) {
    const { marriageType, spouseAId, spouseBId, spouseBNewMemberData } = certificate;

    if (marriageType === 'intra') {
        // Both are existing members — link them and mark married
        await Member.findByIdAndUpdate(spouseAId, {
            maritalStatus: 'married',
            spouseId: spouseBId
        });
        await Member.findByIdAndUpdate(spouseBId, {
            maritalStatus: 'married',
            spouseId: spouseAId
        });

    } else if (marriageType === 'incoming') {
        // Create new member for the incoming spouse
        const { fullName, gender, dateOfBirth, mobileNumber, currentHouseholdId } = spouseBNewMemberData;

        let memberNumber = '';
        let nextSequence = 0;

        if (currentHouseholdId) {
            const updatedHousehold = await Household.findOneAndUpdate(
                { _id: currentHouseholdId, organizationId: orgId },
                { $inc: { memberCounter: 1 } },
                { new: true }
            );
            if (!updatedHousehold) throw new NotFoundError('Household not found for new member');
            nextSequence = updatedHousehold.memberCounter;
            memberNumber = `${updatedHousehold.houseNumber}-${nextSequence}`;
        } else {
            const updatedOrg = await Organization.findOneAndUpdate(
                { _id: orgId },
                { $inc: { independentMemberCounter: 1 } },
                { new: true }
            );
            if (!updatedOrg) throw new NotFoundError('Organization not found');
            nextSequence = updatedOrg.independentMemberCounter;
            memberNumber = `${updatedOrg.orgNumber}-0-${nextSequence}`;
        }

        const newMember = new Member({
            organizationId: orgId,
            memberSequence: nextSequence,
            memberNumber,
            fullName,
            gender,
            dateOfBirth,
            mobileNumber,
            currentHouseholdId: currentHouseholdId || undefined,
            maritalStatus: 'married',
            spouseId: spouseAId,
            status: 'active',
            createdByUserId: issuedByUserId
        });
        await newMember.save();

        // Trigger fee auto-assignment
        autoAssignPlansToNewTarget(orgId, newMember._id, 'MEMBER', issuedByUserId).catch(err =>
            console.error('Failed auto-assigning plans to incoming spouse member:', err)
        );

        // Link spouseA back
        await Member.findByIdAndUpdate(spouseAId, {
            maritalStatus: 'married',
            spouseId: newMember._id
        });

        // Persist the new member id on the certificate
        certificate.spouseBId = newMember._id;

    } else if (marriageType === 'outgoing') {
        // Mark spouseA as relocated due to marriage
        await Member.findByIdAndUpdate(spouseAId, {
            maritalStatus: 'married',
            status: 'relocated',
            relocationReason: 'marriage',
            relocatedAt: new Date()
        });
    }
}

// ─── Controller Exports ───────────────────────────────────────────────────────

/**
 * GET /api/organizations/:orgId/certificates/marriage
 */
exports.getCertificates = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const { page = 1, limit = 20, status } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const filter = { organizationId: orgId };
        if (status) filter.status = status;

        const [certificates, total] = await Promise.all([
            MarriageCertificate.find(filter)
                .populate('spouseAId', 'fullName memberNumber gender')
                .populate('spouseBId', 'fullName memberNumber gender')
                .populate('approvals.memberId', 'fullName')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            MarriageCertificate.countDocuments(filter)
        ]);

        res.json({
            success: true,
            data: certificates,
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
 * POST /api/organizations/:orgId/certificates/marriage
 * Creates a NEW certificate in "pending" status.
 * No member side-effects yet.
 */
exports.createCertificate = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const {
            marriageDate,
            venue,
            marriageType,
            spouseAId,
            spouseBId,
            spouseBNewMemberData,
            spouseBExternal,
            witnesses,
            notes
        } = req.body;

        // ── Validate required fields
        if (!marriageDate || !marriageType || !spouseAId) {
            throw new ValidationError('marriageDate, marriageType, and spouseAId are required');
        }

        // ── Validate spouseA exists in this org
        const spouseA = await Member.findOne({ _id: spouseAId, organizationId: orgId, isDeleted: false });
        if (!spouseA) throw new NotFoundError('Spouse A (member) not found in this organisation');

        // ── Prevent duplicate active certificates for the same member
        const existing = await MarriageCertificate.findOne({
            spouseAId,
            status: { $in: ['pending', 'issued'] }
        });
        if (existing) {
            throw new ValidationError('This member already has an active or pending marriage certificate');
        }

        // ── Type-specific validation
        if (marriageType === 'intra') {
            if (!spouseBId) throw new ValidationError('spouseBId is required for intra-org marriages');
            const spouseB = await Member.findOne({ _id: spouseBId, organizationId: orgId, isDeleted: false });
            if (!spouseB) throw new NotFoundError('Spouse B (member) not found in this organisation');
        } else if (marriageType === 'incoming') {
            if (!spouseBNewMemberData?.fullName || !spouseBNewMemberData?.gender) {
                throw new ValidationError('spouseBNewMemberData (fullName, gender) is required for incoming marriages');
            }
        } else if (marriageType === 'outgoing') {
            if (!spouseBExternal?.fullName) {
                throw new ValidationError('spouseBExternal.fullName is required for outgoing marriages');
            }
        }

        const certificateNumber = await generateCertNumber(orgId, 'MC');

        const certificate = new MarriageCertificate({
            organizationId: orgId,
            certificateNumber,
            marriageDate,
            venue,
            marriageType,
            spouseAId,
            spouseBId: marriageType === 'intra' ? spouseBId : undefined,
            spouseBNewMemberData: marriageType === 'incoming' ? spouseBNewMemberData : undefined,
            spouseBExternal: marriageType === 'outgoing' ? spouseBExternal : undefined,
            witnesses,
            notes,
            status: 'pending',
            issuedByUserId: req.user.uid
        });

        await certificate.save();

        logger.info('Marriage certificate created (pending)', {
            certificateId: certificate._id,
            organizationId: orgId,
            createdBy: req.user.uid
        });

        const populated = await MarriageCertificate.findById(certificate._id)
            .populate('spouseAId', 'fullName memberNumber gender')
            .populate('spouseBId', 'fullName memberNumber gender');

        res.status(201).json({ success: true, data: populated });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/organizations/:orgId/certificates/marriage/:id/approve
 * Records an approval from an authorised committee member.
 * When requiredApprovals threshold is hit: fires member side-effects + marks as issued.
 */
exports.approveCertificate = async (req, res, next) => {
    try {
        const { orgId, id } = req.params;
        const { notes } = req.body;
        const userId = req.user.uid;
        let userMemberId = req.user.memberId; 

        // ── Fallback: if memberId is not in token, look it up by UID (sparse bridge)
        if (!userMemberId) {
            const memberRecord = await Member.findOne({ userId, organizationId: orgId });
            if (memberRecord) {
                userMemberId = memberRecord._id;
            }
        }

        // ── Fetch certificate
        const certificate = await MarriageCertificate.findOne({ _id: id, organizationId: orgId });
        if (!certificate) throw new NotFoundError('Certificate not found');
        if (certificate.status !== 'pending') {
            throw new ValidationError(`Certificate is already ${certificate.status}`);
        }

        // ── Fetch org settings to know who is authorised
        const settings = await OrgSettings.findOne({ organizationId: orgId });
        const committeeId = settings?.approvalSettings?.approverCommitteeId;
        const allowedRoles = settings?.approvalSettings?.approverRoles || [];
        const requiredApprovals = settings?.approvalSettings?.requiredApprovals || 3;

        if (!committeeId) {
            throw new ValidationError('No approver committee is configured for this organisation. Please set it in Org Settings.');
        }

        // ── Confirm the current user is an active member of the approver committee with allowed role
        const committeeMemberFilter = {
            committeeId,
            organizationId: orgId,
            memberId: userMemberId,
            status: 'active'
        };
        if (allowedRoles.length > 0) {
            committeeMemberFilter.role = { $in: allowedRoles };
        }

        const committeeMember = await CommitteeMember.findOne(committeeMemberFilter);
        if (!committeeMember) {
            throw new ValidationError('You are not authorised to approve this certificate');
        }

        // ── Prevent duplicate approvals from same person
        const alreadyApproved = certificate.approvals.some(
            a => a.memberId.toString() === userMemberId?.toString()
        );
        if (alreadyApproved) {
            throw new ValidationError('You have already approved this certificate');
        }

        // ── Record the approval
        certificate.approvals.push({
            committeeMemberId: committeeMember._id,
            memberId: userMemberId,
            approvedAt: new Date(),
            notes
        });

        // ── Check if threshold reached
        if (certificate.approvals.length >= requiredApprovals) {
            certificate.status = 'issued';
            certificate.issuedAt = new Date();

            // Fire member side-effects
            await applyMemberSideEffects(certificate, orgId, userId);

            logger.info('Marriage certificate issued after approvals', {
                certificateId: certificate._id,
                organizationId: orgId,
                approvalCount: certificate.approvals.length
            });
        }

        await certificate.save();

        const populated = await MarriageCertificate.findById(certificate._id)
            .populate('spouseAId', 'fullName memberNumber gender')
            .populate('spouseBId', 'fullName memberNumber gender')
            .populate('approvals.memberId', 'fullName');

        res.json({ success: true, data: populated });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/organizations/:orgId/certificates/marriage/:id/status
 * Only allows annulment of an issued certificate.
 */
exports.updateCertificateStatus = async (req, res, next) => {
    try {
        const { orgId, id } = req.params;
        const { status, annulmentReason } = req.body;

        if (status !== 'annulled') {
            throw new ValidationError('Only "annulled" is a valid status update');
        }

        const certificate = await MarriageCertificate.findOne({ _id: id, organizationId: orgId });
        if (!certificate) throw new NotFoundError('Certificate not found');
        if (certificate.status !== 'issued') {
            throw new ValidationError('Only issued certificates can be annulled');
        }

        certificate.status = 'annulled';
        certificate.annulledAt = new Date();
        certificate.annulledByUserId = req.user.uid;
        certificate.annulmentReason = annulmentReason;

        await certificate.save();

        logger.info('Marriage certificate annulled', {
            certificateId: certificate._id,
            organizationId: orgId,
            annulledBy: req.user.uid
        });

        res.json({ success: true, data: certificate });
    } catch (error) {
        next(error);
    }
};
