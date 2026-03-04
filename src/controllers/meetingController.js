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
    const { orgId } = req.params;
    const { committeeId, title, meetingDate, location, agenda, minutes, status } = req.body;

    // Validate required fields
    if (!title || !meetingDate || !location) {
      throw new ValidationError('Missing required fields: title, meetingDate, location');
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
      title,
      meetingDate,
      location,
      agenda: agenda || [],
      minutes: minutes || [],
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
    const { orgId } = req.params;
    const { page = 1, limit = 10, committeeId } = req.query;
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
          select: 'fullName'
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
    const { title, meetingDate, location, agenda, minutes, status } = req.body;

    // Apply tenant filter
    const filter = { _id: id, organizationId: orgId, ...req.tenantFilter };

    const meeting = await Meeting.findOne(filter);

    if (!meeting) {
      throw new NotFoundError('Meeting not found');
    }

    // Update fields
    if (title) meeting.title = title;
    // ensure legacy meetings have a title before saving to avoid validation errors
    if (!meeting.title) meeting.title = 'Untitled Meeting';

    // Handle legacy agenda data (sometimes stored as string or array of strings)
    let currentAgenda = agenda || meeting.agenda;
    if (typeof currentAgenda === 'string') {
      currentAgenda = [{ topic: currentAgenda, status: 'discussed' }];
    } else if (Array.isArray(currentAgenda)) {
      currentAgenda = currentAgenda.map(item => {
        if (typeof item === 'string') return { topic: item, status: 'discussed' };
        if (item && !item.topic) return { ...item, topic: 'Untitled Topic' };
        return item;
      });
    } else {
      currentAgenda = [];
    }
    meeting.agenda = currentAgenda;

    // Handle legacy minutes data (ensure it's an array)
    if (minutes !== undefined) {
      if (typeof minutes === 'string') {
        meeting.minutes = [{ content: minutes, loggedAt: new Date() }];
      } else if (Array.isArray(minutes)) {
        meeting.minutes = minutes.map(m => {
          if (typeof m === 'string') return { content: m, loggedAt: new Date() };
          if (m && !m.content) return { ...m, content: 'Untitled Content' };
          return m;
        });
      } else {
        meeting.minutes = [];
      }
    } else if (typeof meeting.minutes === 'string') {
      meeting.minutes = [{ content: meeting.minutes, loggedAt: new Date() }];
    } else if (!Array.isArray(meeting.minutes)) {
      meeting.minutes = [];
    }

    if (meetingDate) meeting.meetingDate = meetingDate;
    if (location) meeting.location = location;
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

    if (meeting.attendanceFinalized) {
      throw new ValidationError('Attendance is already finalized and cannot be changed.');
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
          select: 'fullName'
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

    // Check if meeting is finalized
    const meeting = await Meeting.findOne({ _id: attendance.meetingId, organizationId: orgId });
    if (meeting && meeting.attendanceFinalized) {
      throw new ValidationError('Attendance is already finalized and cannot be changed.');
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

/**
 * Soft delete meeting
 */
exports.deleteMeeting = async (req, res, next) => {
  try {
    const { orgId, id } = req.params;

    // Apply tenant filter
    const filter = { _id: id, organizationId: orgId, ...req.tenantFilter };

    const meeting = await Meeting.findOne(filter);

    if (!meeting) {
      throw new NotFoundError('Meeting not found');
    }

    await Meeting.deleteOne({ _id: id });

    logger.info('Meeting deleted', {
      meetingId: id,
      organizationId: orgId,
      updatedBy: req.user.uid
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Finalize attendance for a meeting
 */
exports.finalizeAttendance = async (req, res, next) => {
  try {
    const { orgId, meetingId } = req.params;

    const meeting = await Meeting.findOne({ _id: meetingId, organizationId: orgId });
    if (!meeting) {
      throw new NotFoundError('Meeting not found');
    }

    meeting.attendanceFinalized = true;
    await meeting.save();

    logger.info('Attendance finalized', {
      meetingId,
      organizationId: orgId,
      finalizedBy: req.user.uid
    });

    res.json({
      success: true,
      data: meeting
    });
  } catch (error) {
    next(error);
  }
};
