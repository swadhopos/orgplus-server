const DeathRegister = require('../models/DeathRegister');
const Member = require('../models/Member');

// Create a new death record
exports.createDeathRecord = async (req, res) => {
    try {
        const {
            organizationId,
            memberId,
            householdId,
            dateOfDeath,
            causeOfDeath,
            placeOfDeath,
            burialPlace,
            burialLocation,
            reportedBy,
            certificateNumber,
            officialCertificateUrl,
            notes
        } = req.body;

        // Check if member already has a death record
        const existingRecord = await DeathRegister.findOne({ memberId });
        if (existingRecord) {
            return res.status(400).json({ error: 'A death record already exists for this member' });
        }

        const newRecord = new DeathRegister({
            organizationId,
            memberId,
            householdId,
            dateOfDeath,
            causeOfDeath,
            placeOfDeath,
            burialPlace,
            burialLocation,
            reportedBy,
            certificateNumber,
            officialCertificateUrl,
            notes,
            createdByUserId: req.user?._id || 'system' // Replace with proper auth user
        });

        await newRecord.save();
        res.status(201).json(newRecord);
    } catch (error) {
        console.error('Error creating death record:', error);
        res.status(500).json({ error: 'Failed to create death record' });
    }
};

// Get all death records for an organization
exports.getDeathRecords = async (req, res) => {
    try {
        const { organizationId } = req.query;

        if (!organizationId) {
            return res.status(400).json({ error: 'organizationId query parameter is required' });
        }

        const records = await DeathRegister.find({ organizationId })
            .populate('memberId', 'fullName mobileNumber gender')
            .populate('householdId', 'name householdNumber')
            .sort({ dateOfDeath: -1 });

        res.json(records);
    } catch (error) {
        console.error('Error fetching death records:', error);
        res.status(500).json({ error: 'Failed to fetch death records' });
    }
};

// Get a single death record by ID
exports.getDeathRecordById = async (req, res) => {
    try {
        const record = await DeathRegister.findById(req.params.id)
            .populate('memberId')
            .populate('householdId');

        if (!record) {
            return res.status(404).json({ error: 'Death record not found' });
        }

        res.json(record);
    } catch (error) {
        console.error('Error fetching death record:', error);
        res.status(500).json({ error: 'Failed to fetch death record' });
    }
};

// Update a death record
exports.updateDeathRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Prevent updating critical verification fields directly through this generic route
        delete updateData.status;
        delete updateData.verifiedByUserId;
        delete updateData.verifiedAt;

        const record = await DeathRegister.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!record) {
            return res.status(404).json({ error: 'Death record not found' });
        }

        res.json(record);
    } catch (error) {
        console.error('Error updating death record:', error);
        res.status(500).json({ error: 'Failed to update death record' });
    }
};

// Verify/Reject a death record
exports.verifyDeathRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        if (!['verified', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Must be verified or rejected.' });
        }

        const record = await DeathRegister.findById(id);
        if (!record) {
            return res.status(404).json({ error: 'Death record not found' });
        }

        if (record.status === 'verified') {
            return res.status(400).json({ error: 'Record is already verified' });
        }

        record.status = status;
        if (notes) record.notes = notes;

        if (status === 'verified') {
            record.verifiedByUserId = req.user?._id || 'admin'; // Replace with proper auth user
            record.verifiedAt = new Date();

            // Cascade update to Member record
            await Member.findByIdAndUpdate(record.memberId, {
                $set: {
                    isDeceased: true,
                    status: 'deceased',
                    deathDate: record.dateOfDeath,
                    deathCause: record.causeOfDeath
                }
            });
            // Optionally handle removing as Head of Household if needed
        }

        await record.save();

        const populatedRecord = await DeathRegister.findById(id)
            .populate('memberId')
            .populate('householdId');

        res.json(populatedRecord);
    } catch (error) {
        console.error('Error verifing death record:', error);
        res.status(500).json({ error: 'Failed to verify death record' });
    }
};

// Delete a death record (only if pending/rejected)
exports.deleteDeathRecord = async (req, res) => {
    try {
        const record = await DeathRegister.findById(req.params.id);

        if (!record) {
            return res.status(404).json({ error: 'Death record not found' });
        }

        if (record.status === 'verified') {
            return res.status(400).json({ error: 'Cannot delete a verified death record' });
        }

        await DeathRegister.findByIdAndDelete(req.params.id);
        res.json({ message: 'Death record deleted successfully' });
    } catch (error) {
        console.error('Error deleting death record:', error);
        res.status(500).json({ error: 'Failed to delete death record' });
    }
};
