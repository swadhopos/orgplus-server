const OrgSettings = require('../models/OrgSettings');
const Committee = require('../models/Committee');

/**
 * GET /api/organizations/:orgId/settings
 * Returns existing settings or a sensible default.
 */
exports.getSettings = async (req, res) => {
    try {
        const { orgId } = req.params;
        let settings = await OrgSettings.findOne({ organizationId: orgId })
            .populate('approvalSettings.approverCommitteeId', 'name type status');

        if (!settings) {
            return res.json({
                success: true,
                data: {
                    organizationId: orgId,
                    approvalSettings: {
                        approverCommitteeId: null,
                        approverRoles: [],
                        requiredApprovals: 3
                    }
                }
            });
        }

        res.json({ success: true, data: settings });
    } catch (err) {
        console.error('getSettings error:', err);
        res.status(500).json({ error: 'Failed to load organisation settings' });
    }
};

/**
 * PUT /api/organizations/:orgId/settings
 * Upserts org settings.
 */
exports.updateSettings = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { approvalSettings } = req.body;

        const update = { updatedByUserId: req.user?.id };

        if (approvalSettings) {
            // Validate committee exists if provided
            if (approvalSettings.approverCommitteeId) {
                const committee = await Committee.findById(approvalSettings.approverCommitteeId);
                if (!committee) {
                    return res.status(404).json({ error: 'Committee not found' });
                }
            }
            update.approvalSettings = approvalSettings;
        }

        const settings = await OrgSettings.findOneAndUpdate(
            { organizationId: orgId },
            { $set: update },
            { new: true, upsert: true, runValidators: true }
        ).populate('approvalSettings.approverCommitteeId', 'name type status');

        res.json({ success: true, data: settings });
    } catch (err) {
        console.error('updateSettings error:', err);
        res.status(500).json({ error: 'Failed to update organisation settings' });
    }
};
