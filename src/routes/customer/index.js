const express = require('express');
const router = express.Router();

const { requireCustomerAuth } = require('../../middleware/customerAuth');
const authController = require('../../controllers/customer/authController');
const dashboardController = require('../../controllers/customer/dashboardController');
const noticeController = require('../../controllers/customer/noticeController');
const paymentController = require('../../controllers/customer/paymentController');
const memberController = require('../../controllers/customer/memberController');

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

// Payments & History
router.get('/payments/dues', paymentController.getPendingDues);
router.get('/payments/history', paymentController.getPaymentHistory);

// Member & Household
router.get('/profile', memberController.getProfile);
router.get('/profile/household', memberController.getHouseholdMembers);
router.patch('/profile', memberController.updateProfile);

module.exports = router;
