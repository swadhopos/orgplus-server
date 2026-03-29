const Staff = require('../models/Staff');
const { createUser, setCustomClaims, getUserByEmail, getUserByUid } = require('../config/firebase');
const { NotFoundError, ValidationError, ConflictError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Helper to sync Firebase custom claims for a staff member
 */
const syncStaffClaims = async (uid, orgId) => {
    await setCustomClaims(uid, {
        orgId,
        role: 'staff'
    });
};

/**
 * Create a new staff member
 */
exports.createStaff = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const { name, email, phone, staffType, permissions, status, password } = req.body;

        if (!name || !email || !staffType) {
            throw new ValidationError('Missing required fields: name, email, staffType');
        }

        // Check if staff already exists in this org
        const existingStaff = await Staff.findOne({ email: email.toLowerCase(), orgId, isDeleted: false });
        if (existingStaff) {
            throw new ConflictError('A staff member with this email already exists in this organization.');
        }

        let firebaseUser = await getUserByEmail(email);
        let uid;

        if (!firebaseUser) {
            if (!password) {
                throw new ValidationError('Password is required for new users');
            }
            firebaseUser = await createUser(email, password);
            uid = firebaseUser.uid;
        } else {
            uid = firebaseUser.uid;
            // Check if user is already staff in another org? Optional, depending on multi-tenant isolation rules.
        }

        // Update Firebase claims
        await syncStaffClaims(uid, orgId);

        // Create staff document
        const staff = new Staff({
            userId: uid,
            orgId,
            name,
            email,
            phone,
            staffType,
            permissions: permissions || [],
            status: status || 'active',
            createdByUserId: req.user.uid
        });

        await staff.save();

        logger.info('Staff member created', {
            staffId: staff._id,
            userId: uid,
            orgId,
            createdBy: req.user.uid
        });

        res.status(201).json({
            success: true,
            data: staff
        });
    } catch (error) {
        next(error);
    }
};

/**
 * List staff members
 */
exports.listStaff = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const { page = 1, limit = 10, search } = req.query;
        const skip = (page - 1) * limit;

        const filter = { orgId, isDeleted: false };

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { staffType: { $regex: search, $options: 'i' } }
            ];
        }

        const staffMembers = await Staff.find(filter)
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await Staff.countDocuments(filter);

        res.json({
            success: true,
            data: staffMembers,
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
 * Get staff member by ID
 */
exports.getStaff = async (req, res, next) => {
    try {
        const { orgId, id } = req.params;

        const staff = await Staff.findOne({ _id: id, orgId, isDeleted: false });

        if (!staff) {
            throw new NotFoundError('Staff member not found');
        }

        res.json({
            success: true,
            data: staff
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update staff member
 */
exports.updateStaff = async (req, res, next) => {
    try {
        const { orgId, id } = req.params;
        const { name, phone, staffType, permissions, status } = req.body;

        const staff = await Staff.findOne({ _id: id, orgId, isDeleted: false });

        if (!staff) {
            throw new NotFoundError('Staff member not found');
        }

        if (name) staff.name = name;
        if (phone !== undefined) staff.phone = phone;
        if (staffType) staff.staffType = staffType;
        if (status) staff.status = status;

        let permissionsUpdated = false;
        if (permissions !== undefined) {
            staff.permissions = permissions;
            permissionsUpdated = true;
        }

        await staff.save();

        // Sync claims if needed (currently permissions are in DB, so no sync needed for permission changes)
        // However, we call it to ensure basic claims are present if this is an older account
        if (permissionsUpdated) {
            await syncStaffClaims(staff.userId, orgId);
        }

        logger.info('Staff member updated', {
            staffId: staff._id,
            orgId,
            updatedBy: req.user.uid
        });

        res.json({
            success: true,
            data: staff
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Soft delete staff member
 */
exports.deleteStaff = async (req, res, next) => {
    try {
        const { orgId, id } = req.params;

        const staff = await Staff.findOne({ _id: id, orgId, isDeleted: false });

        if (!staff) {
            throw new NotFoundError('Staff member not found');
        }

        // Soft delete
        staff.isDeleted = true;
        staff.deletedAt = new Date();
        staff.deletedByUserId = req.user.uid;

        await staff.save();

        // Remove staff permissions from claims or reset role
        // For simplicity, we can strip the permissions and change role to 'user' or leave as is if we want soft delete to just remove org access
        // Here we will clear the claims for safety
        try {
            await setCustomClaims(staff.userId, { orgId: null, role: 'user' });
        } catch (claimErr) {
            logger.error('Failed to clear claims on staff delete', { error: claimErr, userId: staff.userId });
        }

        logger.info('Staff member deleted', {
            staffId: staff._id,
            orgId,
            deletedBy: req.user.uid
        });

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

/**
 * Get current staff member's profile and permissions
 */
exports.getStaffMe = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const uid = req.user.uid;

        const staff = await Staff.findOne({ userId: uid, orgId, isDeleted: false });

        if (!staff) {
            throw new NotFoundError('Staff profile not found');
        }

        res.json({
            success: true,
            data: staff
        });
    } catch (error) {
        next(error);
    }
};
