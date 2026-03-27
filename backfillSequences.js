require('dotenv').config();
const mongoose = require('mongoose');
const Event = require('./src/models/Event');
const FeePlan = require('./src/models/FeePlan');
const Counter = require('./src/models/Counter');
const Organization = require('./src/models/Organization');

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const orgs = await Organization.find();
        
        for (const org of orgs) {
            console.log(`Processing org: ${org._id}`);
            
            // Backfill Events
            const events = await Event.find({ organizationId: org._id, eventSequence: { $exists: false } }).sort({ createdAt: 1 });
            for (const event of events) {
                const seq = await Counter.getNextSequence(org._id, 'event', 'eventSequence');
                event.eventSequence = seq;
                await event.save();
                console.log(`  Set event ${event.name} sequence to ${seq}`);
            }

            // Backfill FeePlans
            const plans = await FeePlan.find({ organizationId: org._id, planSequence: { $exists: false } }).sort({ createdAt: 1 });
            for (const plan of plans) {
                const seq = await Counter.getNextSequence(org._id, 'feePlan', 'planSequence');
                plan.planSequence = seq;
                await plan.save();
                console.log(`  Set feePlan ${plan.name} sequence to ${seq}`);
            }
        }
        
        console.log('Backfill complete!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
