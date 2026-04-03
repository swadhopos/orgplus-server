const express = require('express');
const router = express.Router();

const { requireCustomerAuth } = require('../../middleware/customerAuth');
const authController = require('../../controllers/customer/authController');
const dashboardController = require('../../controllers/customer/dashboardController');
const noticeController = require('../../controllers/customer/noticeController');
const paymentController = require('../../controllers/customer/paymentController');
const memberController = require('../../controllers/customer/memberController');
const eventController = require('../../controllers/customer/eventController');

// Public customer routes (e.g. initial login token verification)
router.post('/auth/login', authController.login);

// Protected customer routes
router.use(requireCustomerAuth);

// Auth & Profile
router.get('/auth/me', authController.getProfile);
router.post('/auth/change-password', authController.changePassword);

// Dashboard
router.get('/dashboard', dashboardController.getDashboardSummary);

// Notices
router.get('/notices', noticeController.getNotices);
router.get('/notices/:id', noticeController.getNoticeById);

// Disable browser HTTP caching for payment routes — prevents 304 empty-body issues
// React Query handles its own caching; browser cache causes stale/empty state on refresh
const noCache = (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
};

// Payments & History
router.get('/payments/dues', noCache, paymentController.getPendingDues);
router.get('/payments/history', noCache, paymentController.getPaymentHistory);

// Events & Fundraisers
router.get('/events', eventController.getActiveEvents);
router.post('/events/:id/pledge', eventController.pledgeEvent);

// Member & Household
const householdController = require('../../controllers/customer/householdController');
router.get('/profile', memberController.getProfile);
router.get('/profile/household', memberController.getHouseholdMembers);
router.patch('/profile', memberController.updateProfile);
router.post('/members', memberController.createMember);
router.patch('/members/:id', memberController.updateMember);
router.get('/household/my-group', householdController.getGroupDetails);
router.patch('/household/my-group', householdController.updateHousehold);

module.exports = router;
