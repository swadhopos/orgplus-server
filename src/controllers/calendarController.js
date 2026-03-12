const CalendarBooking = require('../models/CalendarBooking');
const Event = require('../models/Event');
const Meeting = require('../models/Meeting');
const { AppError } = require('../middleware/errorHandler');

/**
 * Get unified calendar items for a specific date range
 * Highly efficient: Uses indexed queries with $gte and $lte to only fetch documents within the month,
 * maps them into a lightweight uniform { id, title, type, date, startTime, endTime } array for the frontend.
 */
exports.getCalendarItems = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            throw new AppError('Date range (startDate, endDate) is required parameters', 400);
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        // 0. Auto-complete past custom bookings (Optimized: only runs if a significant time has passed or lazily)
        // To prevent this from running on every single GET, we check if it's been run recently.
        // For now, we'll keep it simple but ensure it uses the correct index.
        await CalendarBooking.updateMany(
            {
                organizationId: orgId,
                status: 'scheduled',
                autoCompleteWhenExpired: true,
                $or: [
                    { date: { $lt: startOfToday } },
                    { date: startOfToday, endTime: { $lt: currentTime } }
                ]
            },
            { $set: { status: 'completed', updatedAt: new Date() } }
        );

        // Define visibility filter based on user role
        // Admins/Staff see everything, others only see 'public'
        const isInternalUser = ['admin', 'staff', 'systemAdmin'].includes(req.user.role);
        const visibilityFilter = isInternalUser ? {} : { visibility: 'public' };


        // 1. Fetch Events efficiently (only active/upcoming/ongoing)
        const eventsPromise = Event.find({
            organizationId: orgId,
            isDeleted: false,
            ...visibilityFilter,
            // Fetch if it starts within range OR (it started before but ends within/after the range)
            $or: [
                { startDate: { $gte: start, $lte: end } },
                { startDate: { $lt: start }, endDate: { $gte: start } }
            ]
        }).select('_id name type startDate endDate startTime endTime location status visibility description').lean();

        // 2. Fetch Meetings efficiently
        const meetingsPromise = Meeting.find({
            organizationId: orgId,
            meetingDate: { $gte: start, $lte: end },
            status: { $in: ['scheduled', 'completed'] },
            ...visibilityFilter
        }).select('_id title meetingDate startTime endTime location status visibility description').lean();

        // 3. Fetch Custom Calendar Bookings efficiently (Marriages, Funerals, etc)
        const bookingsPromise = CalendarBooking.find({
            organizationId: orgId,
            date: { $gte: start, $lte: end },
            ...visibilityFilter
        }).select('_id title type date startTime endTime location status visibility description').lean();

        // Resolve all in parallel for speed
        const [events, meetings, bookings] = await Promise.all([
            eventsPromise,
            meetingsPromise,
            bookingsPromise
        ]);

        // Map everything to a unified format for the UI Calendar Grid
        const unifiedItems = [
            ...events.map(e => ({
                id: e._id,
                source: 'event', // identifies the collection
                title: e.name,
                type: e.type,
                date: e.startDate, // Need primary tracking date
                endDate: e.endDate,
                startTime: e.startTime,
                endTime: e.endTime,
                location: e.location,
                status: e.status,
                visibility: e.visibility,
                description: e.description
            })),
            ...meetings.map(m => ({
                id: m._id,
                source: 'meeting',
                title: m.title,
                type: 'committee_meeting',
                date: m.meetingDate,
                endDate: m.meetingDate,
                startTime: m.startTime,
                endTime: m.endTime,
                location: m.location,
                status: m.status,
                visibility: m.visibility,
                description: m.description
            })),
            ...bookings.map(b => ({
                id: b._id,
                source: 'booking',
                title: b.title,
                type: b.type,
                date: b.date,
                endDate: b.date,
                startTime: b.startTime,
                endTime: b.endTime,
                location: b.location,
                status: b.status,
                visibility: b.visibility,
                description: b.description
            }))
        ];

        res.status(200).json({
            status: 'success',
            data: unifiedItems
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Check if there is a scheduling conflict at the specified time/location.
 */
exports.checkConflicts = async (req, res, next) => {
    try {
        const organizationId = req.user.orgId; // Corrected from organizationId to orgId
        const { date, startTime, endTime, excludeId } = req.body;

        if (!date || !startTime || !endTime) {
            throw new AppError('Date, startTime, and endTime are required for conflict checking', 400);
        }

        const checkDate = new Date(date);

        // Start of day and End of day to catch all events on this day
        const startOfDay = new Date(checkDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(checkDate.setHours(23, 59, 59, 999));

        // Get all items targeting exactly this date
        const events = await Event.find({
            organizationId,
            isDeleted: false,
            startDate: { $gte: startOfDay, $lte: endOfDay },
            _id: { $ne: excludeId }
        }).lean();

        const meetings = await Meeting.find({
            organizationId,
            meetingDate: { $gte: startOfDay, $lte: endOfDay },
            status: { $ne: 'cancelled' },
            _id: { $ne: excludeId }
        }).lean();

        const bookings = await CalendarBooking.find({
            organizationId,
            date: { $gte: startOfDay, $lte: endOfDay },
            _id: { $ne: excludeId }
        }).lean();

        // Helper function to convert "HH:mm" to minutes since midnight for easy overlap checking
        const timeToMins = (timeStr) => {
            if (!timeStr) return null;
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        };

        const newStartMins = timeToMins(startTime);
        const newEndMins = timeToMins(endTime);

        let conflicts = [];

        // Check helper
        const checkOverlap = (item, type, itemStart, itemEnd) => {
            if (!itemStart || !itemEnd) return; // If existing item has no time, we can't accurately say it conflicts at a specific time
            const startMins = timeToMins(itemStart);
            const endMins = timeToMins(itemEnd);

            // Overlap condition: (StartA < EndB) and (EndA > StartB)
            if (newStartMins < endMins && newEndMins > startMins) {
                conflicts.push({
                    id: item._id,
                    title: item.name || item.title,
                    type: type,
                    startTime: itemStart,
                    endTime: itemEnd,
                    location: item.location
                });
            }
        };

        events.forEach(e => checkOverlap(e, 'event', e.startTime, e.endTime));
        meetings.forEach(m => checkOverlap(m, 'meeting', m.startTime, m.endTime));
        bookings.forEach(b => checkOverlap(b, 'booking', b.startTime, b.endTime));

        res.status(200).json({
            status: 'success',
            hasConflict: conflicts.length > 0,
            conflicts
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Core CRUD for custom pure-calendar Bookings
 */
exports.createBooking = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const bookingData = {
            ...req.body,
            organizationId: orgId,
            createdByUserId: req.user.uid
        };

        const booking = await CalendarBooking.create(bookingData);

        res.status(201).json({
            status: 'success',
            data: booking
        });
    } catch (error) {
        next(error);
    }
};

exports.updateBooking = async (req, res, next) => {
    try {
        const { orgId, bookingId } = req.params;
        const booking = await CalendarBooking.findOneAndUpdate(
            { _id: bookingId, organizationId: orgId },
            req.body,
            { new: true, runValidators: true }
        );

        if (!booking) {
            throw new AppError('Booking not found', 404);
        }

        res.status(200).json({
            status: 'success',
            data: booking
        });
    } catch (error) {
        next(error);
    }
};

exports.deleteBooking = async (req, res, next) => {
    try {
        const { bookingId } = req.params;
        const booking = await CalendarBooking.findOneAndDelete({
            _id: bookingId,
            organizationId: req.user.orgId // Corrected from organizationId to orgId
        });

        if (!booking) {
            throw new AppError('Booking not found', 404);
        }

        res.status(200).json({
            status: 'success',
            data: null
        });
    } catch (error) {
        next(error);
    }
};
