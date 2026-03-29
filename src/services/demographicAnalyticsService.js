const mongoose = require('mongoose');
const Member = require('../models/Member');
const Household = require('../models/Household');
const DeathRegister = require('../models/DeathRegister');

const getGrowthTrend = async (orgId) => {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const trend = await Member.aggregate([
        { 
            $match: { 
                organizationId: orgId, 
                isDeleted: false,
                createdAt: { $gte: twelveMonthsAgo }
            } 
        },
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' }
                },
                count: { $sum: 1 }
            }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Fill gaps for last 12 months
    const fullTrend = [];
    const currentDate = new Date(twelveMonthsAgo);
    const now = new Date();
    
    while (currentDate <= now) {
        const y = currentDate.getFullYear();
        const m = currentDate.getMonth() + 1;
        const found = trend.find(t => t._id.year === y && t._id.month === m);
        fullTrend.push({
            month: `${monthNames[m - 1]} ${y.toString().slice(2)}`,
            count: found ? found.count : 0
        });
        currentDate.setMonth(currentDate.getMonth() + 1);
    }
    return fullTrend;
};

const getDemographicStats = async (orgId) => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const matchStage = { organizationId: orgId, isDeleted: false };

    // Big facet query for members
    const [result] = await Member.aggregate([
        { $match: matchStage },
        {
            $addFields: {
                age: {
                    $cond: {
                        if: { $ne: ['$dateOfBirth', null] },
                        then: {
                            $floor: {
                                $divide: [
                                    { $subtract: [new Date(), '$dateOfBirth'] },
                                    1000 * 60 * 60 * 24 * 365.25
                                ]
                            }
                        },
                        else: null
                    }
                }
            }
        },
        {
            $facet: {
                statusBreakdown: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
                genderBreakdown: [{ $group: { _id: '$gender', count: { $sum: 1 } } }],
                bloodGroups: [{ $group: { _id: '$medicalInfo.bloodGroup', count: { $sum: 1 } } }],
                maritalStatus: [{ $group: { _id: '$maritalStatus', count: { $sum: 1 } } }],
                ages: [
                    { $match: { age: { $ne: null } } },
                    {
                        $group: {
                            _id: null,
                            avgAge: { $avg: '$age' },
                            minAge: { $min: '$age' },
                            maxAge: { $max: '$age' }
                        }
                    }
                ],
                ageBuckets: [
                    { $match: { age: { $ne: null } } },
                    {
                        $bucket: {
                            groupBy: '$age',
                            boundaries: [0, 18, 30, 45, 60],
                            default: '60+',
                            output: { count: { $sum: 1 } }
                        }
                    }
                ],
                workingAbroad: [
                    { $match: { isWorkingAbroad: true } },
                    { $group: { _id: '$abroadCountry', count: { $sum: 1 } } },
                    { $sort: { count: -1 } }
                ],
                occupations: [
                    { $match: { occupation: { $nin: [null, '', 'N/A'] } } },
                    { $group: { _id: '$occupation', count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                    { $limit: 5 }
                ],
                newThisMonth: [
                    { $match: { createdAt: { $gte: firstDayOfMonth } } },
                    { $count: 'count' }
                ],
                // Derived segments
                communitySegments: [
                    {
                        $group: {
                            _id: null,
                            minors: { $sum: { $cond: [{ $lt: ['$age', 18] }, 1, 0] } },
                            schoolGoingAge: { $sum: { $cond: [{ $and: [{ $gte: ['$age', 5] }, { $lt: ['$age', 18] }] }, 1, 0] } },
                            collegeGoingAge: { $sum: { $cond: [{ $and: [{ $gte: ['$age', 18] }, { $lte: ['$age', 22] }, { $eq: ['$maritalStatus', 'single'] }] }, 1, 0] } },
                            marriageableSingles: { $sum: { $cond: [{ $and: [{ $gte: ['$age', 18] }, { $eq: ['$maritalStatus', 'single'] }] }, 1, 0] } },
                            marriageableSinglesMale: { $sum: { $cond: [{ $and: [{ $gte: ['$age', 18] }, { $eq: ['$maritalStatus', 'single'] }, { $eq: ['$gender', 'male'] }] }, 1, 0] } },
                            marriageableSinglesFemale: { $sum: { $cond: [{ $and: [{ $gte: ['$age', 18] }, { $eq: ['$maritalStatus', 'single'] }, { $eq: ['$gender', 'female'] }] }, 1, 0] } },
                            workingAge: { $sum: { $cond: [{ $and: [{ $gte: ['$age', 18] }, { $lt: ['$age', 60] }] }, 1, 0] } },
                            seniorCitizens: { $sum: { $cond: [{ $gte: ['$age', 60] }, 1, 0] } },
                            withSystemLogin: { $sum: { $cond: [{ $ne: ['$userId', null] }, 1, 0] } },
                            withMobile: { $sum: { $cond: [{ $and: [{ $ne: ['$mobileNumber', null] }, { $ne: ['$mobileNumber', ''] }] }, 1, 0] } },
                            withEmail: { $sum: { $cond: [{ $and: [{ $ne: ['$email', null] }, { $ne: ['$email', ''] }] }, 1, 0] } },
                            withVerifiedRelationships: { $sum: { $cond: [{ $eq: ['$isRelationshipVerified', true] }, 1, 0] } }
                        }
                    }
                ]
            }
        }
    ]);

    return result || {};
};

const getHouseholdStats = async (orgId) => {
    const [result] = await Household.aggregate([
        { $match: { organizationId: orgId, isDeleted: false } },
        {
            $facet: {
                statusBreakdown: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
                financialStatus: [{ $group: { _id: '$financialStatus', count: { $sum: 1 } } }],
                total: [{ $count: 'count' }]
            }
        }
    ]);

    // Calculate household heads from Member collection
    const headCount = await Member.countDocuments({ organizationId: orgId, isDeleted: false, _id: { $in: await Household.distinct('headMemberId', { organizationId: orgId, isDeleted: false }) } });

    // Average size: Total Members in households / Total Households
    // Since we filtered isDeleted=false active households, let's just use active members with householdId
    const memsInHouseholds = await Member.countDocuments({ organizationId: orgId, isDeleted: false, currentHouseholdId: { $ne: null } });
    
    const totalCount = result.total[0]?.count || 0;
    const avgSize = totalCount > 0 ? (memsInHouseholds / totalCount) : 0;

    return { result, headCount, avgSize };
};

const getMortalityStats = async (orgId) => {
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    
    const [result] = await DeathRegister.aggregate([
        { $match: { organizationId: orgId } },
        {
            $facet: {
                total: [{ $count: 'count' }],
                thisYear: [
                    { $match: { dateOfDeath: { $gte: startOfYear } } },
                    { $count: 'count' }
                ],
                byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
                topCauses: [
                    { $match: { causeOfDeath: { $nin: [null, ''] } } },
                    { $group: { _id: '$causeOfDeath', count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                    { $limit: 5 }
                ]
            }
        }
    ]);
    return result || {};
};

exports.compute = async (orgId, orgConfig) => {
    const orgIdObj = new mongoose.Types.ObjectId(orgId);
    
    const hasGroups = orgConfig?.features?.hasGroups && orgConfig?.membershipModel !== 'individual_only';

    const [memberStats, growthTrend, mortalityRaw] = await Promise.all([
        getDemographicStats(orgIdObj),
        getGrowthTrend(orgIdObj),
        getMortalityStats(orgIdObj)
    ]);

    const getCount = (arr, idRaw, defaultVal = 0) => {
        const id = (idRaw || '').toLowerCase();
        const found = arr.find(x => (x._id || '').toLowerCase() === id);
        return found ? found.count : defaultVal;
    };

    const statusSum = (arr) => arr.reduce((acc, curr) => acc + curr.count, 0);

    const data = memberStats;
    const seg = data.communitySegments?.[0] || {};
    const ageInfo = data.ages?.[0] || { avgAge: 0, minAge: 0, maxAge: 0 };
    const totalMembers = statusSum(data.statusBreakdown || []);
    const verifiedRelsCount = 0; // Requires deep aggregation if needed, let's omit or approximate if not easily available.

    const result = {
        population: {
            total: totalMembers,
            active: getCount(data.statusBreakdown, 'active'),
            inactive: getCount(data.statusBreakdown, 'inactive'),
            relocated: getCount(data.statusBreakdown, 'relocated'),
            deceased: getCount(data.statusBreakdown, 'deceased'),
            newThisMonth: data.newThisMonth?.[0]?.count || 0,
            growthTrend
        },
        gender: {
            male: getCount(data.genderBreakdown, 'male'),
            female: getCount(data.genderBreakdown, 'female'),
            other: getCount(data.genderBreakdown, 'other')
        },
        ageGroups: {
            averageAge: Math.round(ageInfo.avgAge || 0),
            youngest: ageInfo.minAge,
            oldest: ageInfo.maxAge,
            distribution: {
                '0-18': data.ageBuckets?.find(b => b._id === 0)?.count || 0,
                '18-30': data.ageBuckets?.find(b => b._id === 18)?.count || 0,
                '30-45': data.ageBuckets?.find(b => b._id === 30)?.count || 0,
                '45-60': data.ageBuckets?.find(b => b._id === 45)?.count || 0,
                '60+': data.ageBuckets?.find(b => b._id === '60+')?.count || 0
            }
        },
        maritalStatus: {
            single: getCount(data.maritalStatus, 'single'),
            married: getCount(data.maritalStatus, 'married'),
            divorced: getCount(data.maritalStatus, 'divorced'),
            widowed: getCount(data.maritalStatus, 'widowed'),
            separated: getCount(data.maritalStatus, 'separated')
        },
        bloodGroups: data.bloodGroups?.reduce((acc, curr) => {
            if (curr._id) acc[curr._id] = curr.count;
            else acc['unknown'] = curr.count;
            return acc;
        }, { unknown: 0 }) || {},
        work: {
            workingAbroad: data.workingAbroad?.reduce((acc, curr) => acc + curr.count, 0) || 0,
            abroadCountries: data.workingAbroad?.map(x => ({ country: x._id || 'Unknown', count: x.count })) || [],
            topOccupations: data.occupations?.map(x => ({ occupation: x._id || 'Unknown', count: x.count })) || []
        },
        mortality: {
            total: mortalityRaw.total?.[0]?.count || 0,
            thisYear: mortalityRaw.thisYear?.[0]?.count || 0,
            byStatus: {
                pending: getCount(mortalityRaw.byStatus, 'pending'),
                verified: getCount(mortalityRaw.byStatus, 'verified'),
                rejected: getCount(mortalityRaw.byStatus, 'rejected')
            },
            topCauses: mortalityRaw.topCauses?.map(x => ({ cause: x._id, count: x.count })) || []
        },
        dataQuality: {
            withVerifiedRelationships: seg.withVerifiedRelationships || 0,
            withMobile: seg.withMobile || 0,
            withEmail: seg.withEmail || 0,
            withLoginAccess: seg.withSystemLogin || 0,
            totalMembers
        },
        communitySegments: {
            minors: seg.minors || 0,
            schoolGoingAge: seg.schoolGoingAge || 0,
            collegeGoingAge: seg.collegeGoingAge || 0,
            marriageableSingles: seg.marriageableSingles || 0,
            marriageableSinglesMale: seg.marriageableSinglesMale || 0,
            marriageableSinglesFemale: seg.marriageableSinglesFemale || 0,
            workingAge: seg.workingAge || 0,
            seniorCitizens: seg.seniorCitizens || 0,
            widowed: getCount(data.maritalStatus, 'widowed'),
            divorcedOrSeparated: getCount(data.maritalStatus, 'divorced') + getCount(data.maritalStatus, 'separated'),
            householdHeads: 0, // Computed below if hasGroups
            withSystemLogin: seg.withSystemLogin || 0
        }
    };

    if (hasGroups) {
        const hRes = await getHouseholdStats(orgIdObj);
        result.communitySegments.householdHeads = hRes.headCount || 0;
        result.households = {
            total: hRes.result.total?.[0]?.count || 0,
            active: getCount(hRes.result.statusBreakdown, 'active'),
            inactive: getCount(hRes.result.statusBreakdown, 'inactive'),
            relocated: getCount(hRes.result.statusBreakdown, 'relocated'),
            archived: getCount(hRes.result.statusBreakdown, 'archived'),
            averageSize: Number(hRes.avgSize.toFixed(1)),
            financialStatus: {
                APL: getCount(hRes.result.financialStatus, 'apl'),
                BPL: getCount(hRes.result.financialStatus, 'bpl'),
                None: getCount(hRes.result.financialStatus, 'none', getCount(hRes.result.financialStatus, ''))
            }
        };
    }

    return result;
};
