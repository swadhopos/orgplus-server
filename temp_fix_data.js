const mongoose = require('mongoose');
const OrgConfig = require('./src/models/OrgConfig');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/orgplus';

const fix = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const orgId = '69b7ca290120a39d767fa17c';
    
    // Clear any bad records
    await OrgConfig.deleteMany({ organizationId: { $ne: null } });
    console.log('Cleared existing org configs');

    // Insert a correct one
    const config = new OrgConfig({
      organizationId: new mongoose.Types.ObjectId(orgId),
      nicheTypeKey: 'religious',
      membershipModel: 'group_required',
      labels: { groupLabel: 'Family', memberLabel: 'Member' },
      features: {
        hasMembers: true,
        hasGroups: true,
        hasEvents: true,
        hasCommittees: true,
        hasBMD: true,
        hasSubscriptions: true,
        hasNotices: true,
        hasLedger: true,
        hasStaff: true
      },
      idFormat: { format: 'group_member' },
      createdByUserId: 'R70gwgH5gUWqPG7VkNX1cQxndTw2'
    });

    await config.save();
    console.log('\u2705 INSERTED correct OrgConfig for testing');
    
    process.exit(0);
  } catch (err) {
    console.error('Fix failed:', err);
    process.exit(1);
  }
};

fix();
