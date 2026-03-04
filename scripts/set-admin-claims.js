const { admin } = require('../src/config/firebase');
const Organization = require('../src/models/Organization');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const EMAIL = 'northside.admin1932@gmail.com';

async function setClaims() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/orgplus');
        console.log('Connected to MongoDB');

        // Get organization
        const org = await Organization.findOne({ isDeleted: false });
        if (!org) {
            console.error('No organization found in database!');
            process.exit(1);
        }
        console.log(`Using Org: ${org.name} (${org._id})`);

        // Get Firebase user
        const user = await admin.auth().getUserByEmail(EMAIL);
        console.log(`Found Firebase user: ${user.uid}`);

        // Set custom claims
        await admin.auth().setCustomUserClaims(user.uid, {
            role: 'admin',
            orgId: org._id.toString()
        });
        console.log(`Successfully set claims for ${EMAIL}: { role: 'admin', orgId: '${org._id}' }`);

        process.exit(0);
    } catch (error) {
        console.error('Error setting claims:', error);
        process.exit(1);
    }
}

setClaims();
