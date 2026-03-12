const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const FeePlan = require('./src/models/FeePlan');
const Subscription = require('./src/models/Subscription');
const Transaction = require('./src/models/Transaction');
const Member = require('./src/models/Member');
const Household = require('./src/models/Household');

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // 1. Check Fee Plans
        const plans = await FeePlan.find({ isDeleted: false });
        console.log(`\n--- Fee Plans (${plans.length}) ---`);
        plans.forEach(p => {
            console.log(`Plan: ${p.name} | Type: ${p.type} | Target: ${p.targetAudience} | ApplyAll: ${p.applyToAll} | Active: ${p.isActive}`);
        });

        // 2. Check Subscriptions
        const subs = await Subscription.find({ isDeleted: false });
        console.log(`\n--- Subscriptions (${subs.length}) ---`);
        subs.forEach(s => {
            console.log(`Sub ID: ${s._id} | PlanID: ${s.planId} | TargetID: ${s.targetId} | TargetType: ${s.targetType} | Status: ${s.billingStatus}`);
        });

        // 3. Check Invoices
        const invoices = await Transaction.find({ type: 'invoice', 'audit.isDeleted': false });
        console.log(`\n--- Invoices (${invoices.length}) ---`);
        invoices.forEach(i => {
            console.log(`Invoice: ${i.description} | Target: ${i.householdId || i.memberId} | Amount: ${i.amount} | Status: ${i.status}`);
        });

        // 4. Count total members and households
        const memberCount = await Member.countDocuments({ isDeleted: false });
        const householdCount = await Household.countDocuments({ isDeleted: false });
        console.log(`\nTotal Active: Members (${memberCount}), Households (${householdCount})`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
