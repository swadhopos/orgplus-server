const asyncHandler = require('express-async-handler');
const analyticsCacheService = require('../services/analyticsCacheService');


const handleCacheRequest = async (orgId, type, req) => {
    const isRefresh = req.query.refresh === 'true';

    if (isRefresh) {
        const isBurst = await analyticsCacheService.recordRefreshRequest(orgId, type);
        if (isBurst) {
            // Burst limit breached -> Synchronous wait for recompute
            const result = await analyticsCacheService.forceRecompute(orgId, type);
            return {
                data: result.data,
                meta: {
                    freshness: 'fresh',
                    computedAt: result.computedAt,
                    version: result.version,
                    hasGroups: result.hasGroups
                }
            };
        } else {
            // Under limit -> Background rebuild, return currently available/stale
            analyticsCacheService.recomputeAsync(orgId, type);
        }
    }

    const cached = await analyticsCacheService.getOrCompute(orgId, type);
    return {
        data: cached.data,
        meta: {
            freshness: cached.dataFreshness,
            computedAt: cached.computedAt,
            version: cached.version,
            hasGroups: cached.hasGroups
        }
    };
};

// @desc    Get dashboard metrics (merged demographic & financial)
// @route   GET /api/v1/analytics/dashboard
// @access  Private
exports.getDashboardSummary = asyncHandler(async (req, res) => {
    const { orgId } = req.params;
    
    // Fetch both in parallel
    const [demographicResult, financialResult] = await Promise.all([
        handleCacheRequest(orgId, 'demographic', req),
        handleCacheRequest(orgId, 'financial', req)
    ]);

    // Construct the dashboard summary payload (8 cards)
    const dData = demographicResult.data;
    const fData = financialResult.data;

    const payload = {
        demographicCards: {
            totalMembers: dData.population?.total || 0,
            activeMembers: dData.population?.active || 0,
            totalHouseholds: dData.households?.total, // omitted by client if undefined natively
            activeHouseholds: dData.households?.active
        },
        financialCards: {
            netBalance: fData.overview?.netBalance || 0,
            cashPosition: fData.overview?.cashPosition || 0,
            totalIncome: fData.overview?.totalIncome || 0,
            totalExpense: fData.overview?.totalExpense || 0
        },
        meta: {
            demographic: demographicResult.meta,
            financial: financialResult.meta
        }
    };

    return res.json({
        success: true,
        message: 'Analytics dashboard fetched successfully',
        data: payload
    });
});

// @desc    Get detailed demographic report
// @route   GET /api/v1/analytics/reports/demographic
// @access  Private
exports.getDemographicReport = asyncHandler(async (req, res) => {
    const { orgId } = req.params;
    const result = await handleCacheRequest(orgId, 'demographic', req);
    
    return res.json({
        success: true,
        message: 'Demographic report fetched successfully',
        data: result
    });
});

// @desc    Get detailed financial report
// @route   GET /api/v1/analytics/reports/financial
// @access  Private
exports.getFinancialReport = asyncHandler(async (req, res) => {
    const { orgId } = req.params;
    const result = await handleCacheRequest(orgId, 'financial', req);
    
    return res.json({
        success: true,
        message: 'Financial report fetched successfully',
        data: result
    });
});
