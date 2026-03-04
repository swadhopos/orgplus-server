const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/orgplus');
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const orgs = await db.collection('organizations').find({ isDeleted: false }).toArray();

        console.log('\n--- Organizations ---');
        for (const org of orgs) {
            const hCount = await db.collection('households').countDocuments({ organizationId: org._id });
            const mCount = await db.collection('members').countDocuments({ organizationId: org._id });
            console.log(`- ${org.name} | ID: ${org._id} | Households: ${hCount} | Members: ${mCount}`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
