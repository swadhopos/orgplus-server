require('dotenv').config();
const mongoose = require('mongoose');
const { admin } = require('../src/config/firebase');

const clearOrgUsers = async () => {
    const args = process.argv.slice(2);
    const orgId = args[0];

    if (!orgId) {
        console.error('❌ Please provide an Organization ID.');
        console.log('Usage: node clear-org-users.js <organizationId>');
        console.log('Or to clear all organizations: node clear-org-users.js ALL');
        process.exit(1);
    }

    try {
        // 1. Connect to DB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/orgplus');
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;

        // 2. Clear MongoDB Members
        let memberDeleteResult;
        let householdDeleteResult;
        let attendanceDeleteResult;
        let committeeMemberDeleteResult;

        if (orgId === 'ALL') {
            console.log('⚠️ Clearing all members across ALL organizations...');
            memberDeleteResult = await db.collection('members').deleteMany({});
            householdDeleteResult = await db.collection('households').deleteMany({});
            attendanceDeleteResult = await db.collection('attendances').deleteMany({});
            committeeMemberDeleteResult = await db.collection('committeemembers').deleteMany({});
        } else {
            let objectId;
            try {
                objectId = new mongoose.Types.ObjectId(orgId);
            } catch (e) {
                console.error('❌ Invalid Organization ID format.');
                process.exit(1);
            }

            console.log(`🧹 Clearing members for organization: ${orgId}...`);
            memberDeleteResult = await db.collection('members').deleteMany({ organizationId: objectId });
            householdDeleteResult = await db.collection('households').deleteMany({ organizationId: objectId });
            attendanceDeleteResult = await db.collection('attendances').deleteMany({ organizationId: objectId });
            committeeMemberDeleteResult = await db.collection('committeemembers').deleteMany({ organizationId: objectId });
        }

        console.log(`✅ Deleted ${memberDeleteResult?.deletedCount || 0} Members from DB.`);
        console.log(`✅ Deleted ${householdDeleteResult?.deletedCount || 0} Households from DB.`);
        console.log(`✅ Deleted ${attendanceDeleteResult?.deletedCount || 0} Attendances from DB.`);
        console.log(`✅ Deleted ${committeeMemberDeleteResult?.deletedCount || 0} Committee Members from DB.`);

        // 3. Clear Firebase Users
        console.log('🧹 Scanning Firebase Auth users...');

        let deletedFirebaseUsersCount = 0;
        const deleteFirebaseUserPromises = [];

        const listAllUsers = async (nextPageToken) => {
            const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);

            for (const userRecord of listUsersResult.users) {
                const customClaims = userRecord.customClaims || {};

                // If systemAdmin, skip to avoid locking ourselves out
                if (customClaims.role === 'systemAdmin') {
                    continue;
                }

                // Check if user belongs to the target organization
                if (orgId === 'ALL' || customClaims.orgId === orgId) {
                    console.log(`   - Scheduling deletion for Firebase user: ${userRecord.email} (UID: ${userRecord.uid})`);
                    deleteFirebaseUserPromises.push(admin.auth().deleteUser(userRecord.uid));
                    deletedFirebaseUsersCount++;
                }
            }

            if (listUsersResult.pageToken) {
                await listAllUsers(listUsersResult.pageToken);
            }
        };

        await listAllUsers();

        if (deleteFirebaseUserPromises.length > 0) {
            await Promise.all(deleteFirebaseUserPromises);
            console.log(`✅ Successfully deleted ${deletedFirebaseUsersCount} Firebase Auth users.`);
        } else {
            console.log('✅ No corresponding Firebase Auth users found to delete.');
        }

        console.log('\n🎉 Cleanup complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

clearOrgUsers();
