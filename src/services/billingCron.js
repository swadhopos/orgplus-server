const cron = require('node-cron');
const Subscription = require('../models/Subscription');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');
const CapacityCategory = require('../models/CapacityCategory');
const { generateBillingPeriod } = require('../utils/billing');
const { getEffectiveAmount } = require('./subscriptionService');

const Member = require('../models/Member');
const fcmService = require('./fcmService');

const BATCH_SIZE = 100;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Billing Cron Service
 * Runs daily to process recurring subscriptions that are due for billing.
 * Scalable version: Uses MongoDB Cursors and BulkWrite to handle 35k+ members.
 */

async function processSubscriptions() {
    console.log('--- Starting Daily Subscription Billing Process ---');
    const today = new Date();
    // Set to end of day to catch everything due today
    today.setHours(23, 59, 59, 999);

    try {
        // Find all subscriptions where nextBillingDate is today or earlier (using Cursor)
        const subscriptionCursor = Subscription.find({
            billingStatus: { $in: ['ACTIVE', 'PAST_DUE'] },
            nextBillingDate: { $lte: today },
            isDeleted: false
        }).populate('planId').cursor();

        let batch = [];
        let totalGenerated = 0;
        let batchCount = 0;

        for await (const subscription of subscriptionCursor) {
            batch.push(subscription);

            if (batch.length >= BATCH_SIZE) {
                batchCount++;
                const result = await processBatch(batch, batchCount);
                totalGenerated += result;
                batch = [];
                // Breathing room for DB
                await sleep(50);
            }
        }

        // Process remaining docs
        if (batch.length > 0) {
            batchCount++;
            const result = await processBatch(batch, batchCount);
            totalGenerated += result;
        }

        console.log(`--- Finished Daily Billing: Generated ${totalGenerated} invoices across ${batchCount} batches ---`);
    } catch (error) {
        console.error('Error in daily billing cron:', error);
    }
}

/**
 * Process a batch of subscriptions efficiently
 */
async function processBatch(subscriptions, batchNumber) {
    const invoiceDocs = [];
    const subUpdates = [];
    const now = new Date();

    try {
        // 1. Build CapacityCategory stash for this batch only to keep memory bounded
        const orgIds = [...new Set(subscriptions.map(s => s.organizationId.toString()))];
        const categories = await CapacityCategory.find({ 
            organizationId: { $in: orgIds }, 
            isDeleted: false 
        });

        const pricingStash = new Map();
        categories.forEach(cat => {
            pricingStash.set(cat._id.toString(), cat);
        });

        // 2. Build bulk operations
        for (const subscription of subscriptions) {
            const plan = subscription.planId;
            if (!plan || plan.isDeleted || !plan.isActive) continue;

            const nextBilling = subscription.nextBillingDate;
            const amount = await getEffectiveAmount(plan, subscription.targetId, subscription.targetType, null, pricingStash);

            // Compute dueDate for this invoice
            let dueDate = null;
            if (plan.type === 'ONE_TIME' && plan.dueDate) {
                dueDate = plan.dueDate;
            } else if (plan.type === 'RECURRING') {
                // Default to nextBillingDate if no grace period given
                const graceDays = plan.gracePeriodDays || 0;
                dueDate = new Date(nextBilling.getTime() + graceDays * 24 * 60 * 60 * 1000);
            }

            // Create Transaction doc
            invoiceDocs.push({
                organizationId: subscription.organizationId,
                sourceType: 'subscription',
                sourceId: subscription._id,
                memberId: subscription.targetType === 'MEMBER' ? subscription.targetId : null,
                householdId: subscription.targetType === 'HOUSEHOLD' ? subscription.targetId : null,
                type: 'invoice',
                amount: amount,
                currency: plan.currency,
                date: now,
                dueDate: dueDate,
                billingPeriod: generateBillingPeriod(plan.frequency, nextBilling),
                description: `Recurring Invoice for ${plan.name}`,
                status: 'unpaid',
                audit: { createdByUserId: 'SYSTEM_CRON' }
            });

            // Calculate next billing date
            let nextDate = new Date(nextBilling);
            switch (plan.frequency) {
                case 'WEEKLY': nextDate.setDate(nextDate.getDate() + 7); break;
                case 'MONTHLY': nextDate.setMonth(nextDate.getMonth() + 1); break;
                case 'QUARTERLY': nextDate.setMonth(nextDate.getMonth() + 3); break;
                case 'YEARLY': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
            }

            // Safety check for catch-up
            if (nextDate <= now) {
                switch (plan.frequency) {
                    case 'WEEKLY': nextDate.setDate(now.getDate() + 7); break;
                    case 'MONTHLY': nextDate.setMonth(now.getMonth() + 1); break;
                    case 'QUARTERLY': nextDate.setMonth(now.getMonth() + 3); break;
                    case 'YEARLY': nextDate.setFullYear(now.getFullYear() + 1); break;
                }
            }

            subUpdates.push({
                updateOne: {
                    filter: { _id: subscription._id },
                    update: { $set: { nextBillingDate: nextDate, updatedAt: now } }
                }
            });
        }

        // 3. Execute bulk DB writes
        if (invoiceDocs.length > 0) {
            await Transaction.insertMany(invoiceDocs);
            await Subscription.bulkWrite(subUpdates);
            console.log(`[BillingCron] Batch ${batchNumber}: Processed ${invoiceDocs.length} invoices`);
        }

        return invoiceDocs.length;
    } catch (err) {
        console.error(`Error processing batch ${batchNumber}:`, err);
        return 0; // Don't abort other batches
    }
}

/**
 * Sends push notification reminders to members with unpaid invoices.
 * Runs daily at 9:00 AM.
 * Targets: Day 0 (new), Day 3 (reminder), Day 7 (overdue)
 */
async function sendPaymentReminders() {
    console.log('--- Starting Payment Reminder Notification Process ---');
    
    // Windows: Today (0), 3 days ago, 7 days ago
    const now = new Date();
    const triggerDates = [0, 3, 7].map(days => {
        const d = new Date(now);
        d.setDate(d.getDate() - days);
        d.setHours(0, 0, 0, 0);
        const end = new Date(d);
        end.setHours(23, 59, 59, 999);
        return { start: d, end };
    });

    try {
        const transactionCursor = Transaction.find({
            type: 'invoice',
            status: 'unpaid',
            'audit.isDeleted': false,
            date: { 
                $gte: triggerDates[2].start, // Earliest is 7 days ago
                $lte: triggerDates[0].end     // Latest is today
            }
        }).cursor();

        let batch = [];
        let totalProcessed = 0;
        let batchCount = 0;

        for await (const txn of transactionCursor) {
            // Check if this txn falls exactly in one of our windows
            const txnDate = new Date(txn.date);
            const isInWindow = triggerDates.some(w => txnDate >= w.start && txnDate <= w.end);
            
            if (!isInWindow) continue;

            batch.push(txn);

            if (batch.length >= BATCH_SIZE) {
                batchCount++;
                await processReminderBatch(batch, batchCount);
                totalProcessed += batch.length;
                batch = [];
                await sleep(200); // Small breath
            }
        }

        if (batch.length > 0) {
            batchCount++;
            await processReminderBatch(batch, batchCount);
            totalProcessed += batch.length;
        }

        console.log(`--- Finished Payment Reminders: Processed ${totalProcessed} transactions across ${batchCount} batches ---`);
    } catch (error) {
        console.error('Error in payment reminder cron:', error);
    }
}

/**
 * Process a batch of transactions to send reminders
 */
async function processReminderBatch(transactions, batchNumber) {
    try {
        const memberIds = transactions.map(t => t.memberId).filter(id => id);
        if (memberIds.length === 0) return;

        // Fetch members and their FCM tokens
        const members = await Member.find({ _id: { $in: memberIds } })
            .select('fullName fcmTokens');

        const memberMap = new Map();
        members.forEach(m => memberMap.set(m._id.toString(), m));

        // Group by organization or just send individually since fcmService handles chunking
        for (const txn of transactions) {
            const member = memberMap.get(txn.memberId?.toString());
            if (!member || !member.fcmTokens || member.fcmTokens.length === 0) continue;

            const tokens = member.fcmTokens.map(t => t.token);
            const firstName = member.fullName.split(' ')[0];
            const amountStr = `₹${txn.amount}`;
            const period = txn.billingPeriod || 'current period';
            
            // Personalize message based on age of invoice
            const daysOld = Math.floor((new Date() - new Date(txn.date)) / (1000 * 60 * 60 * 24));
            
            let title = 'Payment Due';
            let body = `Hello ${firstName}, your subscription payment of ${amountStr} for ${period} is due.`;

            if (daysOld >= 7) {
                title = 'Payment Overdue';
                body = `Hello ${firstName}, your payment of ${amountStr} is now overdue. Please pay as soon as possible.`;
            } else if (daysOld >= 3) {
                title = 'Payment Reminder';
                body = `Hello ${firstName}, this is a reminder that ${amountStr} is due for ${period}.`;
            }

            const data = {
                type: 'PAYMENT_REMINDER',
                transactionId: txn._id.toString(),
                deepLink: `/billing/pay/${txn._id}`
            };

            const tokenToMemberMap = new Map();
            tokens.forEach(t => tokenToMemberMap.set(t, member._id));

            await fcmService.sendToTokens(tokens, title, body, data, tokenToMemberMap);
            // Brief sleep after each member send to avoid flooding
            await sleep(50);
        }

        console.log(`[ReminderCron] Batch ${batchNumber}: Processed reminders for ${transactions.length} transactions`);
    } catch (err) {
        console.error(`Error in reminder batch ${batchNumber}:`, err);
    }
}

// Initialize the cron jobs
function initBillingCron() {
    // Run every day at midnight server time for invoice generation
    cron.schedule('0 0 * * *', () => {
        processSubscriptions();
    });

    // Run every day at 9:00 AM for payment reminders
    cron.schedule('0 9 * * *', () => {
        sendPaymentReminders();
    });

    console.log('Billing and Reminder cron jobs initialized.');
}

module.exports = {
    initBillingCron,
    processSubscriptions,
    sendPaymentReminders
};


