const Organization = require('../src/models/Organization');
const Household = require('../models/Household');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/orgplus');
        const orgs = await Organization.find({ isDeleted: false });
        console.log('Organizations in DB:');
        for (const org of orgs) {
            const houseCount = await Household.countDocuments({ organizationId: org._id });
            console.log(`- ${org.name} (${org._id}) | Households: ${houseCount}`);
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
