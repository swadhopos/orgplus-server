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
    
    // Determine financial access: Admin roles or staff with explicit permissions
    const isSystemAdmin = req.user.role === 'systemAdmin';
    const isAdmin = req.user.role === 'admin';
    const hasFinancialAccess = isSystemAdmin || isAdmin || (req.user.role === 'staff' && (req.user.permissions?.includes('canManageFinance') || req.user.permissions?.includes('canViewReports')));

    const promises = [
        handleCacheRequest(orgId, 'demographic', req)
    ];

    if (hasFinancialAccess) {
        promises.push(handleCacheRequest(orgId, 'financial', req));
    } else {
        promises.push(Promise.resolve({ data: {}, meta: {} }));
    }

    const [demographicResult, financialResult] = await Promise.all(promises);

    // Construct the dashboard summary payload (8 cards)
    const dData = demographicResult.data || {};
    const fData = financialResult.data || {};

    const payload = {
        demographicCards: {
            totalMembers: dData.population?.total || 0,
            activeMembers: dData.population?.active || 0,
            pendingMembers: dData.population?.pending || 0,
            totalHouseholds: dData.households?.total, // omitted by client if undefined natively
            activeHouseholds: dData.households?.active
        },
        financialCards: hasFinancialAccess ? {
            netBalance: fData.overview?.netBalance || 0,
            cashPosition: fData.overview?.cashPosition || 0,
            totalIncome: fData.overview?.totalIncome || 0,
            totalExpense: fData.overview?.totalExpense || 0
        } : {
            netBalance: 0,
            cashPosition: 0,
            totalIncome: 0,
            totalExpense: 0
        },
        meta: {
            demographic: demographicResult.meta,
            financial: hasFinancialAccess ? financialResult.meta : { freshness: 'fresh', computedAt: new Date() }
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
