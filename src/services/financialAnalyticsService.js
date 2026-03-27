const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Subscription = require('../models/Subscription');
const Event = require('../models/Event');
const Fundraiser = require('../models/Fundraiser');
const Ledger = require('../models/Ledger');

const getMonthlyTrend = async (orgIdObj) => {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const trend = await Transaction.aggregate([
        { 
            $match: { 
                organizationId: orgIdObj,
                'audit.isDeleted': false,
                type: { $in: ['income', 'expense'] },
                status: 'completed',
                date: { $gte: twelveMonthsAgo }
            } 
        },
        {
            $group: {
                _id: {
                    year: { $year: '$date' },
                    month: { $month: '$date' },
                    type: '$type'
                },
                total: { $sum: '$amount' }
            }
        }
    ]);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const fullTrend = [];
    const currentDate = new Date(twelveMonthsAgo);
    const now = new Date();
    
    let highestIncome = { month: null, amount: 0 };
    let highestExpense = { month: null, amount: 0 };

    while (currentDate <= now) {
        const y = currentDate.getFullYear();
        const m = currentDate.getMonth() + 1;
        const inc = trend.find(t => t._id.year === y && t._id.month === m && t._id.type === 'income')?.total || 0;
        const exp = trend.find(t => t._id.year === y && t._id.month === m && t._id.type === 'expense')?.total || 0;
        
        const monthLabel = `${monthNames[m - 1]} ${y.toString().slice(2)}`;
        fullTrend.push({ month: monthLabel, income: inc, expense: exp });

        if (inc >= highestIncome.amount) highestIncome = { month: monthLabel, amount: inc };
        if (exp >= highestExpense.amount) highestExpense = { month: monthLabel, amount: exp };

        currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return { months: fullTrend, highestIncomeMonth: highestIncome, highestExpenseMonth: highestExpense };
};

const getTransactionStats = async (orgIdObj) => {
    const [result] = await Transaction.aggregate([
        { $match: { organizationId: orgIdObj, 'audit.isDeleted': false } },
        {
            $facet: {
                // Only consider completed for actual income/expense
                totals: [
                    { $match: { status: 'completed', type: { $in: ['income', 'expense'] } } },
                    { $group: { _id: '$type', total: { $sum: '$amount' } } }
                ],
                bySource: [
                    { $match: { status: 'completed', type: 'income', sourceType: { $in: ['Ledger', 'Event', 'Fundraiser', 'Subscription'] } } },
                    { $group: { _id: '$sourceType', amount: { $sum: '$amount' }, count: { $sum: 1 } } }
                ],
                incomeByCategory: [
                    { $match: { status: 'completed', type: 'income' } },
                    { $group: { _id: '$categoryId', amount: { $sum: '$amount' } } },
                    { $sort: { amount: -1 } },
                    { $limit: 10 }
                ],
                expenseByCategory: [
                    { $match: { status: 'completed', type: 'expense' } },
                    { $group: { _id: '$categoryId', amount: { $sum: '$amount' } } },
                    { $sort: { amount: -1 } },
                    { $limit: 10 }
                ],
                paymentMethods: [
                    { $match: { status: 'completed', type: 'income' } },
                    { $group: { _id: '$payment.method', amount: { $sum: '$amount' }, count: { $sum: 1 } } }
                ],
                statusBreakdown: [
                    { $group: { _id: '$status', count: { $sum: 1 } } }
                ],
                overdueInvoices: [
                    { $match: { type: 'invoice', status: { $in: ['unpaid', 'partially_paid'] }, dueDate: { $lt: new Date() } } },
                    { $group: { _id: null, count: { $sum: 1 }, totalAmount: { $sum: { $subtract: ['$amount', { $ifNull: ['$paidAmount', 0] }] } } } }
                ],
                outstandingTotals: [
                    { $match: { type: 'invoice', status: { $in: ['unpaid', 'partially_paid', 'completed'] } } },
                    { 
                        $group: { 
                            _id: null, 
                            totalBalance: { 
                                $sum: { 
                                    $cond: [
                                        { $in: ['$status', ['unpaid', 'partially_paid']] },
                                        { $subtract: ['$amount', { $ifNull: ['$paidAmount', 0] }] },
                                        0
                                    ]
                                }
                            }, 
                            totalBilled: { $sum: '$amount' } 
                        } 
                    }
                ]
            }
        }
    ]);
    return result || {};
};

const getSubscriptionStats = async (orgIdObj) => {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const nextMonth = new Date(today);
    nextMonth.setDate(today.getDate() + 30);

    const [result] = await Subscription.aggregate([
        { $match: { organizationId: orgIdObj, isDeleted: false } },
        {
            $lookup: {
                from: 'feeplans',
                localField: 'planId',
                foreignField: '_id',
                as: 'plan'
            }
        },
        { $unwind: '$plan' },
        {
            $facet: {
                statusBreakdown: [
                    { $group: { _id: '$billingStatus', count: { $sum: 1 } } }
                ],
                upcomingThisWeek: [
                    { $match: { nextBillingDate: { $gte: today, $lte: nextWeek } } },
                    { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$plan.amount' } } }
                ],
                upcomingThisMonth: [
                    { $match: { nextBillingDate: { $gte: today, $lte: nextMonth } } },
                    { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$plan.amount' } } }
                ],
                revenueByPlan: [
                    // We need income transactions linked to these plans
                    // But for a simple snapshot, let's group by plan name
                    { $group: { _id: '$plan.name', amount: { $sum: '$plan.amount' }, frequency: { $first: '$plan.frequency' } } },
                    { $sort: { amount: -1 } },
                    { $limit: 5 }
                ],
                collectionMetrics: [
                  { 
                    $group: { 
                      _id: null, 
                      total: { $sum: 1 }, 
                      paid: { $sum: { $cond: [{ $eq: ['$billingStatus', 'COMPLETED'] }, 1, 0] } } 
                    } 
                  }
                ]
            }
        }
    ]);
    
    return result || {};
};

const getEventsAndFundraisers = async (orgIdObj) => {
    const events = await Event.aggregate([
        { $match: { organizationId: orgIdObj, 'audit.isDeleted': false } },
        { $project: { name: '$title', budget: '$financials.estimatedBudget', actual: '$financials.actualExpense', status: 1 } }
    ]);
    
    const mappedEvents = events.map(e => {
        const budget = e.budget || 0;
        const actual = e.actual || 0;
        const variance = actual - budget;
        return {
            name: e.name, budget, actual, variance, status: e.status, isOverBudget: actual > budget
        };
    });

    const fundraisers = await Fundraiser.aggregate([
        { $match: { organizationId: orgIdObj, 'audit.isDeleted': false } },
        { 
            $project: { 
                name: '$title', goalAmount: '$financials.goalAmount', collected: '$financials.collectedAmount', 
                status: 1, startDate: '$timeline.startDate', endDate: '$timeline.endDate'
            } 
        }
    ]);

    const mappedFundraisers = fundraisers.map(f => {
        const goal = f.goalAmount || 1;
        const collected = f.collected || 0;
        return {
            ...f,
            percentAchieved: Math.round((collected / goal) * 100)
        };
    });

    return { events: mappedEvents, fundraisers: mappedFundraisers };
};

const getLedgerStats = async (orgIdObj) => {
    const ledgers = await Ledger.aggregate([
        { $match: { organizationId: orgIdObj, 'audit.isDeleted': false } },
        {
            $lookup: {
                from: 'transactions',
                let: { ledgerId: '$_id' },
                pipeline: [
                    { $match: { $expr: { $and: [ { $eq: ['$sourceId', '$$ledgerId'] }, { $eq: ['$audit.isDeleted', false] }, { $eq: ['$status', 'completed'] } ] } } },
                    { $group: { _id: '$type', total: { $sum: '$amount' } } }
                ],
                as: 'txns'
            }
        }
    ]);

    let totalOpening = 0;
    const finalLedgers = ledgers.map(l => {
        const inc = l.txns.find(t => t._id === 'income')?.total || 0;
        const exp = l.txns.find(t => t._id === 'expense')?.total || 0;
        const open = l.openingBalance || 0;
        totalOpening += open;
        return {
            name: l.name, openingBalance: open, income: inc, expense: exp, balance: open + inc - exp, status: l.status
        };
    });

    return { ledgers: finalLedgers, totalOpeningBalance: totalOpening };
};

const getDuesPerTarget = async (orgIdObj, targetField) => {
    const dues = await Transaction.aggregate([
        { $match: { organizationId: orgIdObj, 'audit.isDeleted': false, type: 'invoice', status: { $in: ['unpaid', 'partially_paid'] }, [targetField]: { $ne: null } } },
        { $group: { _id: `$${targetField}`, totalDue: { $sum: { $subtract: ['$amount', { $ifNull: ['$paidAmount', 0] }] } } } },
        { $match: { totalDue: { $gt: 0 } } },
        { $sort: { totalDue: -1 } },
        { $limit: 1000 } // Safety limit
    ]);
    
    // Top Payers (Income completed)
    const payers = await Transaction.aggregate([
        { $match: { organizationId: orgIdObj, 'audit.isDeleted': false, type: 'income', status: 'completed', [targetField]: { $ne: null } } },
        { $group: { _id: `$${targetField}`, totalPaid: { $sum: '$amount' } } },
        { $sort: { totalPaid: -1 } },
        { $limit: 5 }
    ]);
    
    const count = dues.length;
    const totalAmount = dues.reduce((sum, d) => sum + d.totalDue, 0);

    return {
        withOutstandingDues: { count, totalAmount },
        topPayers: payers.map(p => ({ id: p._id, totalPaid: p.totalPaid }))
        // Note: Realistically, you'd $lookup names here, or fetch them after.
        // Returning ID for now, names can be joined by the caller or UI if needed.
    };
};

exports.compute = async (orgId, orgConfig) => {
    const orgIdObj = new mongoose.Types.ObjectId(orgId);
    const hasGroups = orgConfig?.features?.hasGroups && orgConfig?.membershipModel !== 'individual_only';

    const [monthlyTrend, txStats, subStats, efStats, ledgerStats, memberDues] = await Promise.all([
        getMonthlyTrend(orgIdObj),
        getTransactionStats(orgIdObj),
        getSubscriptionStats(orgIdObj),
        getEventsAndFundraisers(orgIdObj),
        getLedgerStats(orgIdObj),
        getDuesPerTarget(orgIdObj, 'memberId')
    ]);

    const householdDues = hasGroups ? await getDuesPerTarget(orgIdObj, 'householdId') : null;

    const t = txStats;
    const totalIncome = t.totals?.find(x => x._id === 'income')?.total || 0;
    const totalExpense = t.totals?.find(x => x._id === 'expense')?.total || 0;
    
    const outstandingDues = t.outstandingTotals?.[0]?.totalBalance || 0;
    const totalDues = t.outstandingTotals?.[0]?.totalBilled || 0;
    const netBalance = totalIncome - totalExpense;
    const cashPosition = ledgerStats.totalOpeningBalance + netBalance;

    const getCountAmt = (arr, idRaw) => {
        const found = arr?.find(x => x._id === idRaw);
        return { count: found?.count || 0, amount: found?.amount || 0 };
    };
    
    const getStatCount = (arr, idRaw) => arr?.find(x => x._id === idRaw)?.count || 0;

    const result = {
        overview: {
            totalIncome, totalExpense, netBalance,
            openingBalance: ledgerStats.totalOpeningBalance,
            cashPosition, totalOutstandingDues: outstandingDues,
            totalDues
        },
        monthlyTrend,
        incomeBySource: {
            ledger: getCountAmt(t.bySource, 'Ledger'),
            event: getCountAmt(t.bySource, 'Event'),
            fundraiser: getCountAmt(t.bySource, 'Fundraiser'),
            subscription: getCountAmt(t.bySource, 'Subscription')
        },
        incomeByCategory: t.incomeByCategory?.map(x => ({ category: x._id, amount: x.amount })) || [],
        expenseByCategory: t.expenseByCategory?.map(x => ({ category: x._id, amount: x.amount })) || [],
        paymentMethods: t.paymentMethods?.map(x => ({ method: x._id || 'Unknown', count: x.count, amount: x.amount })) || [],
        transactionStatus: {
            completed: getStatCount(t.statusBreakdown, 'completed'),
            pending: getStatCount(t.statusBreakdown, 'pending'),
            cancelled: getStatCount(t.statusBreakdown, 'cancelled'),
            voided: getStatCount(t.statusBreakdown, 'voided'),
            unpaid: getStatCount(t.statusBreakdown, 'unpaid'),
            partially_paid: getStatCount(t.statusBreakdown, 'partially_paid')
        },
        overdueInvoices: {
            count: t.overdueInvoices?.[0]?.count || 0,
            totalAmount: t.overdueInvoices?.[0]?.totalAmount || 0
        },
        subscriptions: {
            active: getStatCount(subStats.statusBreakdown, 'ACTIVE'),
            pastDue: getStatCount(subStats.statusBreakdown, 'PAST_DUE'),
            canceled: getStatCount(subStats.statusBreakdown, 'CANCELED'),
            unpaid: getStatCount(subStats.statusBreakdown, 'UNPAID'),
            completed: getStatCount(subStats.statusBreakdown, 'COMPLETED'),
            voided: getStatCount(subStats.statusBreakdown, 'VOIDED'),
            collectionRate: subStats.collectionMetrics?.[0]?.total ? Math.round((subStats.collectionMetrics[0].paid / subStats.collectionMetrics[0].total) * 100) : 0,
            upcomingBillingThisWeek: { 
                count: subStats.upcomingThisWeek?.[0]?.count || 0, 
                amount: subStats.upcomingThisWeek?.[0]?.amount || 0 
            },
            upcomingBillingThisMonth: { 
                count: subStats.upcomingThisMonth?.[0]?.count || 0, 
                amount: subStats.upcomingThisMonth?.[0]?.amount || 0 
            },
            revenueByPlan: subStats.revenueByPlan?.map(x => ({ planName: x._id, amount: x.amount, frequency: x.frequency })) || []
        },
        events: efStats.events,
        fundraisers: efStats.fundraisers,
        ledgers: ledgerStats.ledgers,
        perMember: memberDues
    };

    if (hasGroups) {
        result.perHousehold = householdDues;
    }

    return result;
};
