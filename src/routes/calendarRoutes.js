const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorize');
const calendarController = require('../controllers/calendarController');

// Protect all routes
router.use(authenticateToken);

// Unified calendar endpoints
// GET /api/organizations/:orgId/calendar?startDate=...&endDate=...
router.get('/', calendarController.getCalendarItems);

// Conflict checking endpoint
// POST /api/organizations/:orgId/calendar/check-conflicts
router.post('/check-conflicts', requireRole('admin', 'staff'), calendarController.checkConflicts);

// Manage custom pure-calendar bookings (marriages, funerals, etc.)
router.post('/bookings', requireRole('admin', 'staff'), calendarController.createBooking);
router.put('/bookings/:bookingId', requireRole('admin', 'staff'), calendarController.updateBooking);
router.delete('/bookings/:bookingId', requireRole('admin', 'staff'), calendarController.deleteBooking);

module.exports = router;
