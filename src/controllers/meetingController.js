const Meeting = require('../models/Meeting');
const Attendance = require('../models/Attendance');
const Committee = require('../models/Committee');
const CommitteeMember = require('../models/CommitteeMember');
const { NotFoundError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Create a new meeting
 */
exports.createMeeting = async (req, res, next) => {
  try {
    const { orgId, committeeId } = req.params;
    const { meetingDate, location, agenda, minutes, status } = req.body;

    // Validate required fields
    if (!meetingDate || !location || !agenda) {
      throw new ValidationError('Missing required fields: meetingDate, location, agenda');
    }

    // Verify committee exists in same organization
    const committee = await Committee.findOne({
      _id: committeeId,
      organizationId: orgId,
      isDeleted: false
    });

    if (!committee) {
      throw new NotFoundError('Committee not found');
    }

    // Create meeting
    const meeting = new Meeting({
      committeeId,
      meetingDate,
      location,
      agenda,
      minutes,
      status: status || 'scheduled',
      organizationId: orgId,
      createdByUserId: req.user.uid
    });

    await meeting.save();

    logger.info('Meeting created', {
      meetingId: meeting._id,
      committeeId,
      organizationId: orgId,
      createdBy: req.user.uid
    });

    res.status(201).json({
      success: true,
      data: meeting
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List meetings for a committee (with tenant filtering)
 */
exports.listMeetings = async (req, res, next) => {
  try {
    const { orgId, committeeId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Apply tenant filter
    const filter = { committeeId, organizationId: orgId, ...req.tenantFilter };

    const meetings = await Meeting.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ meetingDate: -1 });

    const total = await Meeting.countDocuments(filter);

    res.json({
      success: true,
      data: meetings,
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
 * Get meeting by ID (with attendance populated)
 */
exports.getMeeting = async (req, res, next) => {
  try {
    const { orgId, id } = req.params;

    // Apply tenant filter
    const filter = { _id: id, organizationId: orgId, ...req.tenantFilter };

    const meeting = await Meeting.findOne(filter)
      .populate('committeeId', 'name type');

    if (!meeting) {
      throw new NotFoundError('Meeting not found');
    }

    // Get attendance records
    const attendance = await Attendance.find({
      meetingId: id,
      organizationId: orgId
    })
      .populate({
        path: 'committeeMemberId',
        populate: {
          path: 'memberId',
          select: 'firstName lastName'
        }
      });

    res.json({
      success: true,
      data: {
        ...meeting.toObject(),
        attendance
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update meeting
 */
exports.updateMeeting = async (req, res, next) => {
  try {
    const { orgId, id } = req.params;
    const { meetingDate, location, agenda, minutes, status } = req.body;

    // Apply tenant filter
    const filter = { _id: id, organizationId: orgId, ...req.tenantFilter };

    const meeting = await Meeting.findOne(filter);

    if (!meeting) {
      throw new NotFoundError('Meeting not found');
    }

    // Update fields
    if (meetingDate) meeting.meetingDate = meetingDate;
    if (location) meeting.location = location;
    if (agenda) meeting.agenda = agenda;
    if (minutes !== undefined) meeting.minutes = minutes;
    if (status) meeting.status = status;

    await meeting.save();

    logger.info('Meeting updated', {
      meetingId: meeting._id,
      organizationId: orgId,
      updatedBy: req.user.uid
    });

    res.json({
      success: true,
      data: meeting
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Record attendance
 */
exports.recordAttendance = async (req, res, next) => {
  try {
    const { orgId, meetingId } = req.params;
    const { committeeMemberId, attendanceStatus, remarks } = req.body;

    // Validate required fields
    if (!committeeMemberId || !attendanceStatus) {
      throw new ValidationError('Missing required fields: committeeMemberId, attendanceStatus');
    }

    // Verify meeting exists
    const meeting = await Meeting.findOne({
      _id: meetingId,
      organizationId: orgId
    });

    if (!meeting) {
      throw new NotFoundError('Meeting not found');
    }

    // Verify committee member exists and belongs to meeting's committee
    const committeeMember = await CommitteeMember.findOne({
      _id: committeeMemberId,
      committeeId: meeting.committeeId,
      organizationId: orgId
    });

    if (!committeeMember) {
      throw new NotFoundError('Committee member not found or does not belong to this committee');
    }

    // Check if attendance already exists
    let attendance = await Attendance.findOne({
      meetingId,
      committeeMemberId,
      organizationId: orgId
    });

    if (attendance) {
      // Update existing attendance
      attendance.attendanceStatus = attendanceStatus;
      if (remarks !== undefined) attendance.remarks = remarks;
      await attendance.save();
    } else {
      // Create new attendance record
      attendance = new Attendance({
        meetingId,
        committeeMemberId,
        attendanceStatus,
        remarks,
        organizationId: orgId,
        createdByUserId: req.user.uid
      });
      await attendance.save();
    }

    logger.info('Attendance recorded', {
      attendanceId: attendance._id,
      meetingId,
      committeeMemberId,
      organizationId: orgId,
      createdBy: req.user.uid
    });

    res.status(201).json({
      success: true,
      data: attendance
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List attendance for a meeting
 */
exports.listAttendance = async (req, res, next) => {
  try {
    const { orgId, meetingId } = req.params;

    // Apply tenant filter
    const filter = { meetingId, organizationId: orgId, ...req.tenantFilter };

    const attendance = await Attendance.find(filter)
      .populate({
        path: 'committeeMemberId',
        populate: {
          path: 'memberId',
          select: 'firstName lastName'
        }
      })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: attendance
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update attendance
 */
exports.updateAttendance = async (req, res, next) => {
  try {
    const { orgId, id } = req.params;
    const { attendanceStatus, remarks } = req.body;

    // Apply tenant filter
    const filter = { _id: id, organizationId: orgId, ...req.tenantFilter };

    const attendance = await Attendance.findOne(filter);

    if (!attendance) {
      throw new NotFoundError('Attendance record not found');
    }

    // Update fields
    if (attendanceStatus) attendance.attendanceStatus = attendanceStatus;
    if (remarks !== undefined) attendance.remarks = remarks;

    await attendance.save();

    logger.info('Attendance updated', {
      attendanceId: attendance._id,
      organizationId: orgId,
      updatedBy: req.user.uid
    });

    res.json({
      success: true,
      data: attendance
    });
  } catch (error) {
    next(error);
  }
};
