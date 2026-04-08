const cron = require('node-cron');
const Notice = require('../models/Notice');

async function archiveExpiredNotices() {
    console.log('--- Starting Notice Auto-Archiving Process ---');
    const now = new Date();

    try {
        const result = await Notice.updateMany(
            {
                status: 'published',
                expiresAt: { $ne: null, $lte: now },
                isDeleted: false
            },
            {
                $set: { status: 'archived', updatedAt: now }
            }
        );

        console.log(`--- Finished Notice Auto-Archiving: Archived ${result.modifiedCount} notices ---`);
    } catch (error) {
        console.error('Error in notice auto-archive cron:', error);
    }
}

function initNoticeCron() {
    // Run every day at midnight server time
    cron.schedule('0 0 * * *', () => {
        archiveExpiredNotices();
    });

    console.log('Notice auto-archive cron job initialized (Runs every 24 hours).');
}

module.exports = {
    initNoticeCron,
    archiveExpiredNotices
};
