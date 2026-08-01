const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/orgplus';

const checkUser = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Find the member record for the logged in user
    // The logs show userId/createdByUserId could be "R70gwgH5gUWqPG7VkNX1cQxndTw2" or "O2rW0bHjthQDXmieLaB2cQnT7MW2"
    const Member = require('./src/models/Member');
    const Committee = require('./src/models/Committee');
    const CommitteeMember = require('./src/models/CommitteeMember');

    console.log('\n--- Checking Members with userId ---');
    const members = await Member.find({ userId: { $ne: null } });
    members.forEach(m => {
      console.log(`Member: ${m.fullName}, ID: ${m._id}, userId: ${m.userId}, Status: ${m.status}, Role/Marital: ${m.maritalStatus}`);
    });

    console.log('\n--- Checking Main Committee for Org ---');
    const mainCommittee = await Committee.findOne({ 
      organizationId: '69d64f087bbe3b522cb5bc1e',
      isMain: true,
      isDeleted: false
    });
    if (mainCommittee) {
      console.log(`Main Committee: ${mainCommittee.name}, ID: ${mainCommittee._id}, Status: ${mainCommittee.status}`);
      
      const officers = await CommitteeMember.find({ committeeId: mainCommittee._id });
      console.log(`Officers count: ${officers.length}`);
      officers.forEach(o => {
        console.log(`Officer MemberID: ${o.memberId}, Role: ${o.role}, Status: ${o.status}`);
      });
    } else {
      console.log('No active Main Committee found!');
    }

    process.exit(0);
  } catch (err) {
    console.error('Check failed:', err);
    process.exit(1);
  }
};

checkUser();
