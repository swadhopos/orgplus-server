const Committee = require('../models/Committee');
const CommitteeMember = require('../models/CommitteeMember');
const Member = require('../models/Member');
const Meeting = require('../models/Meeting');
const { NotFoundError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');
const { createUser, setCustomClaims, getUserByEmail, getUserByUid } = require('../config/firebase');

// Roles that are entitled to a login in the org app
const PRIVILEGED_ROLES = ['president', 'vice-president', 'secretary', 'treasurer'];

/**
 * Create a new committee
 */
exports.createCommittee = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { name, description, type, status, startDate, endDate, eventId } = req.body;

    if (!name || !type) {
      throw new ValidationError('Missing required fields: name, type');
    }

    const committee = new Committee({
      name,
      description,
      type,
      status: status || 'active',
      startDate,
      endDate,
      eventId: eventId || null,
      organizationId: orgId,
      createdByUserId: req.user.uid
    });

    await committee.save();

    logger.info('Committee created', { committeeId: committee._id, organizationId: orgId, createdBy: req.user.uid });

    res.status(201).json({ success: true, data: committee });
  } catch (error) {
    next(error);
  }
};

/**
 * List committees (with tenant filtering + optional eventId filter)
 */
exports.listCommittees = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { page = 1, limit = 50, eventId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { organizationId: orgId, isDeleted: false, ...req.tenantFilter };
    if (eventId) filter.eventId = eventId;

    const [committees, total] = await Promise.all([
      Committee.find(filter).skip(skip).limit(parseInt(limit)).sort({ createdAt: -1 }),
      Committee.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: committees,
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
 * Get committee by ID (with members populated)
 */
exports.getCommittee = async (req, res, next) => {
  try {
    const { orgId, id } = req.params;

    const filter = { _id: id, organizationId: orgId, isDeleted: false, ...req.tenantFilter };
    const committee = await Committee.findOne(filter);

    if (!committee) throw new NotFoundError('Committee not found');

    const [members, meetings] = await Promise.all([
      CommitteeMember.find({ committeeId: id, organizationId: orgId })
        .populate('memberId', 'fullName memberNumber currentHouseholdId userId email')
        .sort({ role: 1 }),
      Meeting.find({ committeeId: id, organizationId: orgId })
    ]);

    res.json({ success: true, data: { ...committee.toObject(), members, meetings } });
  } catch (error) {
    next(error);
  }
};

/**
 * Update committee
 */
exports.updateCommittee = async (req, res, next) => {
  try {
    const { orgId, id } = req.params;
    const { name, description, type, status, startDate, endDate } = req.body;

    const filter = { _id: id, organizationId: orgId, isDeleted: false, ...req.tenantFilter };
    const committee = await Committee.findOne(filter);

    if (!committee) throw new NotFoundError('Committee not found');

    if (name) committee.name = name;
    if (description !== undefined) committee.description = description;
    if (type) committee.type = type;
    if (status) committee.status = status;
    if (startDate !== undefined) committee.startDate = startDate;
    if (endDate !== undefined) committee.endDate = endDate;

    await committee.save();

    logger.info('Committee updated', { committeeId: committee._id, organizationId: orgId, updatedBy: req.user.uid });

    res.json({ success: true, data: committee });
  } catch (error) {
    next(error);
  }
};

/**
 * Soft delete committee
 */
exports.deleteCommittee = async (req, res, next) => {
  try {
    const { orgId, id } = req.params;

    const filter = { _id: id, organizationId: orgId, isDeleted: false, ...req.tenantFilter };
    const committee = await Committee.findOne(filter);

    if (!committee) throw new NotFoundError('Committee not found');

    committee.isDeleted = true;
    committee.deletedAt = new Date();
    committee.deletedByUserId = req.user.uid;
    await committee.save();

    logger.info('Committee deleted', { committeeId: committee._id, organizationId: orgId, deletedBy: req.user.uid });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Add committee member
 */
exports.addCommitteeMember = async (req, res, next) => {
  try {
    const { orgId, committeeId } = req.params;
    const { memberId, role, startDate, endDate, status, isExternal, externalMemberName, externalMemberPhone } = req.body;

    if (!role || !startDate) {
      throw new ValidationError('Missing required fields: role, startDate');
    }

    if (isExternal) {
      if (!externalMemberName) throw new ValidationError('Missing required field: externalMemberName for external members');
    } else {
      if (!memberId) throw new ValidationError('Missing required field: memberId for internal members');
    }

    const committee = await Committee.findOne({ _id: committeeId, organizationId: orgId, isDeleted: false });
    if (!committee) throw new NotFoundError('Committee not found');

    if (!isExternal) {
      const member = await Member.findOne({ _id: memberId, organizationId: orgId, isDeleted: false });
      if (!member) throw new NotFoundError('Member not found');
    }

    const committeeMember = new CommitteeMember({
      committeeId,
      memberId: isExternal ? undefined : memberId,
      isExternal: !!isExternal,
      externalMemberName,
      externalMemberPhone,
      role,
      startDate,
      endDate,
      status: status || 'active',
      organizationId: orgId,
      createdByUserId: req.user.uid
    });

    await committeeMember.save();

    logger.info('Committee member added', { committeeMemberId: committeeMember._id, committeeId, organizationId: orgId, createdBy: req.user.uid });

    res.status(201).json({ success: true, data: committeeMember });
  } catch (error) {
    next(error);
  }
};

/**
 * List committee members (paginated)
 */
exports.listCommitteeMembers = async (req, res, next) => {
  try {
    const { orgId, committeeId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { committeeId, organizationId: orgId, ...req.tenantFilter };

    const [committeeMembers, total] = await Promise.all([
      CommitteeMember.find(filter)
        .populate('memberId', 'fullName memberNumber currentHouseholdId userId email')
        .sort({ role: 1, startDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      CommitteeMember.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: committeeMembers,
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
 * Update committee member
 */
exports.updateCommitteeMember = async (req, res, next) => {
  try {
    const { orgId, committeeId, id } = req.params;
    const { role, startDate, endDate, status } = req.body;

    const filter = { _id: id, committeeId, organizationId: orgId, ...req.tenantFilter };
    const committeeMember = await CommitteeMember.findOne(filter);

    if (!committeeMember) throw new NotFoundError('Committee member not found');

    if (role) committeeMember.role = role;
    if (startDate) committeeMember.startDate = startDate;
    if (endDate !== undefined) committeeMember.endDate = endDate;
    if (status) committeeMember.status = status;

    await committeeMember.save();

    logger.info('Committee member updated', { committeeMemberId: committeeMember._id, committeeId, organizationId: orgId, updatedBy: req.user.uid });

    res.json({ success: true, data: committeeMember });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove committee member — strips Firebase memberId claim if they had a privileged role.
 */
exports.removeCommitteeMember = async (req, res, next) => {
  try {
    const { orgId, committeeId, id } = req.params;

    const filter = { _id: id, committeeId, organizationId: orgId, ...req.tenantFilter };
    const committeeMember = await CommitteeMember.findOne(filter);

    if (!committeeMember) throw new NotFoundError('Committee member not found');

    // If this was a privileged role, strip the memberId claim from their Firebase token
    if (!committeeMember.isExternal && PRIVILEGED_ROLES.includes(committeeMember.role)) {
      const member = await Member.findById(committeeMember.memberId);
      if (member?.userId) {
        try {
          const firebaseUser = await getUserByUid(member.userId);
          if (firebaseUser) {
            const existingClaims = firebaseUser.customClaims || {};
            const { memberId: _removed, ...strippedClaims } = existingClaims;
            // If this was a committee_member account (not a household head), disable it
            if (existingClaims.role === 'committee_member') {
              await setCustomClaims(member.userId, { ...strippedClaims, role: 'disabled' });
            } else {
              // Household head — just remove the memberId claim
              await setCustomClaims(member.userId, strippedClaims);
            }
          }
        } catch (claimErr) {
          logger.warn('Could not strip Firebase claims on member removal', { error: claimErr.message });
        }
      }
    }

    await committeeMember.deleteOne();

    logger.info('Committee member removed', { committeeMemberId: id, committeeId, organizationId: orgId, deletedBy: req.user.uid });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * POST /:committeeId/members/:memberId/create-login
 *
 * Creates (or links) a Firebase login for a privileged committee officer.
 *
 * Two cases:
 *   A) Member already has a userId (household head with existing login)
 *      → Just patch memberId into their existing Firebase custom claims.
 *
 *   B) Member has no userId (never had a login)
 *      → Create a new Firebase account with the supplied email + password,
 *        set custom claims, write userId back to the Member document.
 *
 * Body: { email, password, role }
 *   - email + password required only for case B
 *   - role required in both cases (must be a PRIVILEGED_ROLE)
 */
exports.createMemberLogin = async (req, res, next) => {
  try {
    const { orgId, committeeId, memberId } = req.params;
    const { email, password, role } = req.body;

    // ── Guard: only privileged roles get a login
    if (!PRIVILEGED_ROLES.includes(role)) {
      return res.status(400).json({
        error: `Only ${PRIVILEGED_ROLES.join(', ')} roles are entitled to a login. Regular committee members cannot log in.`
      });
    }

    // ── Fetch the member
    const member = await Member.findOne({ _id: memberId, organizationId: orgId, isDeleted: false });
    if (!member) throw new NotFoundError('Member not found');

    let firebaseUid;

    if (member.userId) {
      // ── CASE A: Member already has a Firebase account (e.g. household head)
      // Patch memberId into their existing claims without overwriting role/householdId
      const firebaseUser = await getUserByUid(member.userId);
      if (!firebaseUser) {
        return res.status(400).json({ error: 'Member has a stored userId but no matching Firebase account. Please contact support.' });
      }

      const existingClaims = firebaseUser.customClaims || {};
      await setCustomClaims(member.userId, {
        ...existingClaims,
        memberId: member._id.toString()  // ← add the bridge
      });

      firebaseUid = member.userId;

      logger.info('Patched memberId claim onto existing Firebase user', {
        uid: firebaseUid, memberId: member._id, orgId
      });

    } else {
      // ── CASE B: No Firebase account — create one
      if (!email || !password) {
        return res.status(400).json({ error: 'email and password are required to create a new login' });
      }

      // Reject if email already exists in Firebase
      const existingByEmail = await getUserByEmail(email);
      if (existingByEmail) {
        return res.status(409).json({
          error: 'A Firebase account with this email already exists. If this person is a household head, ask them to log in first so the system can link their account automatically.'
        });
      }

      // Create the Firebase account
      const newUser = await createUser(email, password);
      firebaseUid = newUser.uid;

      // Set custom claims
      await setCustomClaims(firebaseUid, {
        orgId: orgId.toString(),
        role: 'committee_member',
        memberId: member._id.toString()
      });

      // Write the Firebase UID back to the Member document
      member.userId = firebaseUid;
      if (email && !member.email) member.email = email;
      await member.save();

      logger.info('Created Firebase login for committee member', {
        uid: firebaseUid, memberId: member._id, email, role, orgId
      });
    }

    res.status(200).json({
      success: true,
      message: 'Login created successfully. The member can now sign in with their credentials.',
      data: {
        memberId: member._id,
        firebaseUid,
        role,
        hasLogin: true
      }
    });

  } catch (error) {
    next(error);
  }
};
