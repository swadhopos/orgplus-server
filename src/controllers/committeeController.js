const Committee = require('../models/Committee');
const CommitteeMember = require('../models/CommitteeMember');
const Member = require('../models/Member');
const Meeting = require('../models/Meeting');
const { NotFoundError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Create a new committee
 */
exports.createCommittee = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { name, description, type, status, startDate, endDate } = req.body;

    // Validate required fields
    if (!name || !type) {
      throw new ValidationError('Missing required fields: name, type');
    }

    // Create committee
    const committee = new Committee({
      name,
      description,
      type,
      status: status || 'active',
      startDate,
      endDate,
      organizationId: orgId,
      createdByUserId: req.user.uid
    });

    await committee.save();

    logger.info('Committee created', {
      committeeId: committee._id,
      organizationId: orgId,
      createdBy: req.user.uid
    });

    res.status(201).json({
      success: true,
      data: committee
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List committees (with tenant filtering)
 */
exports.listCommittees = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Apply tenant filter
    const filter = { organizationId: orgId, isDeleted: false, ...req.tenantFilter };

    const committees = await Committee.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Committee.countDocuments(filter);

    res.json({
      success: true,
      data: committees,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
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

    // Apply tenant filter
    const filter = { _id: id, organizationId: orgId, isDeleted: false, ...req.tenantFilter };

    const committee = await Committee.findOne(filter);

    if (!committee) {
      throw new NotFoundError('Committee not found');
    }

    // Get committee members
    const members = await CommitteeMember.find({
      committeeId: id,
      organizationId: orgId
    })
      .populate('memberId', 'fullName currentHouseholdId')
      .sort({ role: 1 });

    // Get meetings
    const meetings = await Meeting.find({
      committeeId: id,
      organizationId: orgId
    });

    res.json({
      success: true,
      data: {
        ...committee.toObject(),
        members,
        meetings
      }
    });
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

    // Apply tenant filter
    const filter = { _id: id, organizationId: orgId, isDeleted: false, ...req.tenantFilter };

    const committee = await Committee.findOne(filter);

    if (!committee) {
      throw new NotFoundError('Committee not found');
    }

    // Update fields
    if (name) committee.name = name;
    if (description !== undefined) committee.description = description;
    if (type) committee.type = type;
    if (status) committee.status = status;
    if (startDate !== undefined) committee.startDate = startDate;
    if (endDate !== undefined) committee.endDate = endDate;

    await committee.save();

    logger.info('Committee updated', {
      committeeId: committee._id,
      organizationId: orgId,
      updatedBy: req.user.uid
    });

    res.json({
      success: true,
      data: committee
    });
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

    // Apply tenant filter
    const filter = { _id: id, organizationId: orgId, isDeleted: false, ...req.tenantFilter };

    const committee = await Committee.findOne(filter);

    if (!committee) {
      throw new NotFoundError('Committee not found');
    }

    // Soft delete
    committee.isDeleted = true;
    committee.deletedAt = new Date();
    committee.deletedByUserId = req.user.uid;

    await committee.save();

    logger.info('Committee deleted', {
      committeeId: committee._id,
      organizationId: orgId,
      deletedBy: req.user.uid
    });

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

    // Validate required fields
    if (!role || !startDate) {
      throw new ValidationError('Missing required fields: role, startDate');
    }

    if (isExternal) {
      if (!externalMemberName) {
        throw new ValidationError('Missing required field: externalMemberName for external members');
      }
    } else {
      if (!memberId) {
        throw new ValidationError('Missing required field: memberId for internal members');
      }
    }

    // Verify committee exists
    const committee = await Committee.findOne({
      _id: committeeId,
      organizationId: orgId,
      isDeleted: false
    });

    if (!committee) {
      throw new NotFoundError('Committee not found');
    }

    // Verify member exists in same organization if not external
    if (!isExternal) {
      const member = await Member.findOne({
        _id: memberId,
        organizationId: orgId,
        isDeleted: false
      });

      if (!member) {
        throw new NotFoundError('Member not found');
      }
    }

    // Create committee member
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

    logger.info('Committee member added', {
      committeeMemberId: committeeMember._id,
      committeeId,
      memberId,
      organizationId: orgId,
      createdBy: req.user.uid
    });

    res.status(201).json({
      success: true,
      data: committeeMember
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List committee members
 */
exports.listCommitteeMembers = async (req, res, next) => {
  try {
    const { orgId, committeeId } = req.params;

    // Apply tenant filter
    const filter = { committeeId, organizationId: orgId, ...req.tenantFilter };

    const committeeMembers = await CommitteeMember.find(filter)
      .populate('memberId', 'fullName currentHouseholdId')
      .sort({ role: 1, startDate: -1 });

    res.json({
      success: true,
      data: committeeMembers
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

    // Apply tenant filter
    const filter = {
      _id: id,
      committeeId,
      organizationId: orgId,
      ...req.tenantFilter
    };

    const committeeMember = await CommitteeMember.findOne(filter);

    if (!committeeMember) {
      throw new NotFoundError('Committee member not found');
    }

    // Update fields
    if (role) committeeMember.role = role;
    if (startDate) committeeMember.startDate = startDate;
    if (endDate !== undefined) committeeMember.endDate = endDate;
    if (status) committeeMember.status = status;

    await committeeMember.save();

    logger.info('Committee member updated', {
      committeeMemberId: committeeMember._id,
      committeeId,
      organizationId: orgId,
      updatedBy: req.user.uid
    });

    res.json({
      success: true,
      data: committeeMember
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove committee member
 */
exports.removeCommitteeMember = async (req, res, next) => {
  try {
    const { orgId, committeeId, id } = req.params;

    // Apply tenant filter
    const filter = {
      _id: id,
      committeeId,
      organizationId: orgId,
      ...req.tenantFilter
    };

    const committeeMember = await CommitteeMember.findOne(filter);

    if (!committeeMember) {
      throw new NotFoundError('Committee member not found');
    }

    await committeeMember.deleteOne();

    logger.info('Committee member removed', {
      committeeMemberId: id,
      committeeId,
      organizationId: orgId,
      deletedBy: req.user.uid
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
