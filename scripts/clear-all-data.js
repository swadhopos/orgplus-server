require('dotenv').config();
const mongoose = require('mongoose');
const { admin } = require('../src/config/firebase');

const clearAllData = async () => {
    try {
        console.log('🚀 Starting system-wide cleanup...');

        // 1. Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/orgplus';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();

        // 2. Clear all MongoDB collections
        console.log(`🧹 Found ${collections.length} collections. Clearing data...`);
        for (const collection of collections) {
            if (collection.name.startsWith('system.')) continue; // Skip system collections
            
            const result = await db.collection(collection.name).deleteMany({});
            console.log(`   - Cleared collection: ${collection.name} (${result.deletedCount} documents deleted)`);
        }
        console.log('✅ MongoDB data cleared successfully.');

        // 3. Clear Firebase Users except systemAdmin
        console.log('🧹 Scanning Firebase Auth users...');

        let deletedFirebaseUsersCount = 0;
        let skippedSystemAdminsCount = 0;
        const deleteFirebaseUserPromises = [];

        const listAllUsers = async (nextPageToken) => {
            const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);

            for (const userRecord of listUsersResult.users) {
                const customClaims = userRecord.customClaims || {};

                // If systemAdmin, skip to avoid locking ourselves out
                if (customClaims.role === 'systemAdmin') {
                    console.log(`   - Skipping systemAdmin: ${userRecord.email} (UID: ${userRecord.uid})`);
                    skippedSystemAdminsCount++;
                    continue;
                }

                console.log(`   - Scheduling deletion for user: ${userRecord.email} (UID: ${userRecord.uid})`);
                deleteFirebaseUserPromises.push(admin.auth().deleteUser(userRecord.uid));
                deletedFirebaseUsersCount++;
            }

            if (listUsersResult.pageToken) {
                await listAllUsers(listUsersResult.pageToken);
            }
        };

        await listAllUsers();

        if (deleteFirebaseUserPromises.length > 0) {
            console.log(`🗑️ Deleting ${deleteFirebaseUserPromises.length} Firebase users...`);
            await Promise.all(deleteFirebaseUserPromises);
            console.log(`✅ Successfully deleted ${deletedFirebaseUsersCount} Firebase Auth users.`);
        } else {
            console.log('✅ No corresponding Firebase Auth users found to delete.');
        }

        console.log(`ℹ️ Total Summary:`);
        console.log(`   - MongoDB: ${collections.length} collections cleared.`);
        console.log(`   - Firebase: ${deletedFirebaseUsersCount} users deleted.`);
        console.log(`   - Firebase: ${skippedSystemAdminsCount} systemAdmins preserved.`);

        console.log('\n🎉 System RESET complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during cleanup:', error.message);
        process.exit(1);
    }
};

clearAllData();
