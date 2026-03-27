const mongoose = require('mongoose');
const AnalyticsCache = require('../models/AnalyticsCache');
const OrgConfig = require('../models/OrgConfig');
const demographicAnalyticsService = require('./demographicAnalyticsService');
const financialAnalyticsService = require('./financialAnalyticsService');

const demographicTTL = 6 * 60 * 60 * 1000; // 6 hours
const financialTTL = 2 * 60 * 60 * 1000; // 2 hours

const computeServiceData = async (orgIdObj, type, orgConfig) => {
    if (type === 'demographic') {
        return await demographicAnalyticsService.compute(orgIdObj, orgConfig);
    } else if (type === 'financial') {
        return await financialAnalyticsService.compute(orgIdObj, orgConfig);
    }
    throw new Error('Invalid analytics type');
};

const getExpirationTime = (type) => {
    const ttl = type === 'demographic' ? demographicTTL : financialTTL;
    return new Date(Date.now() + ttl);
};

exports.markDirty = async (orgId, type) => {
    await AnalyticsCache.updateOne(
        { organizationId: orgId, type },
        { $set: { isDirty: true } },
        { upsert: true }
    );
};

exports.recordRefreshRequest = async (orgId, type) => {
    // Keep window of 10 mins
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    // We update and get the new document
    const cache = await AnalyticsCache.findOneAndUpdate(
        { organizationId: orgId, type },
        { 
            $push: { refreshRequests: new Date() }
        },
        { new: true, upsert: true }
    );
    
    // Prune logic + length check in memory to avoid complex mongo update checks
    let recentRequests = [];
    if (cache && cache.refreshRequests) {
        recentRequests = cache.refreshRequests.filter(d => d >= tenMinsAgo);
        
        // Background clean-up of old requests
        if (cache.refreshRequests.length > recentRequests.length + 5) {
            AnalyticsCache.updateOne(
                { _id: cache._id },
                { $pull: { refreshRequests: { $lt: tenMinsAgo } } }
            ).catch(e => console.error('[Analytics] Failed to prune refresh requests', e));
        }
    }
    
    return recentRequests.length >= 6;
};

exports.forceRecompute = async (orgId, type) => {
    const orgIdObj = new mongoose.Types.ObjectId(orgId);
    const orgConfig = await OrgConfig.findOne({ organizationId: orgIdObj }).lean();
    
    const hasGroups = orgConfig?.features?.hasGroups && orgConfig?.membershipModel !== 'individual_only';

    let data;
    try {
        data = await computeServiceData(orgIdObj, type, orgConfig);
        
        const now = new Date();
        const expires = getExpirationTime(type);

        const cache = await AnalyticsCache.findOneAndUpdate(
            { organizationId: orgIdObj, type },
            {
                $set: {
                    data,
                    computedAt: now,
                    expiresAt: expires,
                    isDirty: false,
                    isRebuilding: false,
                    hasGroups: !!hasGroups
                },
                $inc: { version: 1 }
            },
            { upsert: true, new: true }
        );
        
        return { 
            data, 
            hasGroups: !!hasGroups, 
            computedAt: now, 
            expiresAt: expires, 
            version: cache.version 
        };
    } catch (error) {
        console.error(`[AnalyticsCacheService] Error computing ${type} for org ${orgId}:`, error);
        await AnalyticsCache.updateOne(
            { organizationId: orgIdObj, type },
            { $set: { isRebuilding: false } }
        );
        throw error;
    }
};

exports.recomputeAsync = async (orgId, type) => {
    const orgIdObj = new mongoose.Types.ObjectId(orgId);
    
    // Mark as rebuilding
    await AnalyticsCache.updateOne(
        { organizationId: orgIdObj, type },
        { $set: { isRebuilding: true } },
        { upsert: true }
    );

    // Fire and forget computation
    setImmediate(async () => {
        try {
            await this.forceRecompute(orgId, type);
        } catch (err) {
            console.error('[AnalyticsCacheService] Async recompute failed:', err);
        }
    });
};

exports.getOrCompute = async (orgId, type) => {
    const cache = await AnalyticsCache.findOne({ organizationId: orgId, type }).lean();

    if (!cache || !cache.data || Object.keys(cache.data).length === 0) {
        // Complete miss, must compute synchronously
        const result = await this.forceRecompute(orgId, type);
        return { 
            data: result.data, 
            dataFreshness: 'fresh', 
            hasGroups: result.hasGroups,
            computedAt: result.computedAt,
            expiresAt: result.expiresAt,
            version: result.version
        };
    }

    const isExpired = new Date() > cache.expiresAt;

    if (cache.isRebuilding) {
        return { 
            data: cache.data, 
            dataFreshness: 'rebuilding', 
            hasGroups: !!cache.hasGroups,
            computedAt: cache.computedAt,
            expiresAt: cache.expiresAt,
            version: cache.version
        };
    }

    if (cache.isDirty || isExpired) {
        // Trigger background rebuild and return stale data
        this.recomputeAsync(orgId, type);
        return { 
            data: cache.data, 
            dataFreshness: 'stale', 
            hasGroups: !!cache.hasGroups,
            computedAt: cache.computedAt,
            expiresAt: cache.expiresAt,
            version: cache.version
        };
    }

    // Fresh
    return { 
        data: cache.data, 
        dataFreshness: 'fresh', 
        hasGroups: !!cache.hasGroups,
        computedAt: cache.computedAt,
        expiresAt: cache.expiresAt,
        version: cache.version
    };
};
