const mongoose = require('mongoose');

async function run() {
    const uri = "mongodb://localhost:27017/orgplus";

    try {
        await mongoose.connect(uri);
        const db = mongoose.connection.db;
        const membersColl = db.collection('members');
        const orgId = new mongoose.Types.ObjectId("69c11b157df946f6af47d26d");

        const members = await membersColl.find({ organizationId: orgId }).toArray();
        console.log(`Total members found in DB: ${members.length}`);
        
        let pending = 0;
        let active = 0;
        let deleted = 0;
        let otherStatus = 0;
        let diffVerification = 0;

        members.forEach(m => {
            if (m.isDeleted) {
                deleted++;
            } else if (m.verificationStatus === 'pending') {
                pending++;
            } else if (m.verificationStatus === 'verified') {
                if (m.status === 'active') active++;
                else otherStatus++;
            } else {
                diffVerification++;
            }
        });

        console.log(`- Deleted: ${deleted}`);
        console.log(`- Pending (verificationStatus: 'pending'): ${pending}`);
        console.log(`- Active (verified & status: 'active'): ${active}`);
        console.log(`- Other Status (verified but not active): ${otherStatus}`);
        console.log(`- Difference Verification (rejected, etc): ${diffVerification}`);

        console.log('\nSample Pending Member Names:');
        members.filter(m => !m.isDeleted && m.verificationStatus === 'pending').forEach(m => console.log(m.fullName));

    } finally {
        await mongoose.connection.close();
    }
}
run().catch(console.dir);
