const mongoose = require('mongoose');

async function run() {
    const uri = "mongodb://localhost:27017/orgplus";

    try {
        await mongoose.connect(uri);
        const db = mongoose.connection.db;
        const membersColl = db.collection('members');
        const orgId = new mongoose.Types.ObjectId("69c11b157df946f6af47d26d");

        const members = await membersColl.find({ organizationId: orgId }).toArray();
        
        console.log('\nChecking non-active members:');
        members.forEach(m => {
            if (m.verificationStatus !== 'verified' || m.status !== 'active') {
                console.log(`- ${m.fullName}: verificationStatus=${m.verificationStatus}, status=${m.status}, isDeleted=${m.isDeleted}`);
            }
        });

    } finally {
        await mongoose.connection.close();
    }
}
run().catch(console.dir);
