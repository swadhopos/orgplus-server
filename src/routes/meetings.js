const express = require('express');
const router = express.Router({ mergeParams: true });
const meetingController = require('../controllers/meetingController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorize');
const { applyTenantFilter } = require('../middleware/tenantFilter');

// All routes require admin or systemAdmin role
router.use(requireRole('systemAdmin', 'admin'));

// All routes apply tenant filtering
router.use(applyTenantFilter);

// Create meeting
router.post('/', meetingController.createMeeting);

// List meetings for a committee
router.get('/', meetingController.listMeetings);

// Get meeting by ID
router.get('/:id', meetingController.getMeeting);

// Update meeting
router.put('/:id', meetingController.updateMeeting);

// Delete meeting
router.delete('/:id', meetingController.deleteMeeting);

// Attendance routes
router.post('/:meetingId/attendance', meetingController.recordAttendance);
router.get('/:meetingId/attendance', meetingController.listAttendance);

// Update attendance (separate route for updating specific attendance record)
router.put('/attendance/:id', meetingController.updateAttendance);

// Finalize attendance
router.post('/:meetingId/finalize-attendance', meetingController.finalizeAttendance);

module.exports = router;
