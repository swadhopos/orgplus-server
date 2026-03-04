const express = require('express');
const router = express.Router({ mergeParams: true }); // Merge params to access orgId
const staffController = require('../controllers/staffController');
const { requireRole } = require('../middleware/authorize');

// Only Admins can manage staff
// Apply requireRole middleware to all staff routes
router.use(requireRole('systemAdmin', 'admin'));

/**
 * @route   POST /api/organizations/:orgId/staff
 * @desc    Create a new staff member
 * @access  Private (Admin only)
 */
router.post('/', staffController.createStaff);

/**
 * @route   GET /api/organizations/:orgId/staff
 * @desc    Get all staff members in the organization
 * @access  Private (Admin only)
 */
router.get('/', staffController.listStaff);

/**
 * @route   GET /api/organizations/:orgId/staff/:id
 * @desc    Get a specific staff member by ID
 * @access  Private (Admin only)
 */
router.get('/:id', staffController.getStaff);

/**
 * @route   PUT /api/organizations/:orgId/staff/:id
 * @desc    Update a staff member
 * @access  Private (Admin only)
 */
router.put('/:id', staffController.updateStaff);

/**
 * @route   DELETE /api/organizations/:orgId/staff/:id
 * @desc    Delete a staff member
 * @access  Private (Admin only)
 */
router.delete('/:id', staffController.deleteStaff);

module.exports = router;
