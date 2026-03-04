const { admin } = require('../src/config/firebase');
const mongoose = require('mongoose');

const EMAIL = 'northside.admin1932@gmail.com';
const CORRECT_ORG_ID = '69a1bea0477cc7838ac3cb3a';

async function setClaims() {
    try {
        const user = await admin.auth().getUserByEmail(EMAIL);
        console.log(`Found Firebase user: ${user.uid}`);

        await admin.auth().setCustomUserClaims(user.uid, {
            role: 'admin',
            orgId: CORRECT_ORG_ID
        });
        console.log(`Successfully set claims for ${EMAIL}: { role: 'admin', orgId: '${CORRECT_ORG_ID}' }`);

        process.exit(0);
    } catch (error) {
        console.error('Error setting claims:', error);
        process.exit(1);
    }
}

setClaims();
