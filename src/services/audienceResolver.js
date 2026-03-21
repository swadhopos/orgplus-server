const Member = require('../models/Member');
const CommitteeMember = require('../models/CommitteeMember');
const Subscription = require('../models/Subscription');
const FeePlan = require('../models/FeePlan');
const logger = require('../utils/logger');

/**
 * audienceResolver — resolves the FCM delivery strategy for a given notice.
 *
 * Returns one of:
 *  { type: 'topic', topic: string }
 *  { type: 'tokens', tokens: string[], tokenToMemberMap: Map<string, ObjectId> }
 *
 * Topic-based: members subscribe automatically (zero server queries at publish time).
 * Token-batch: server resolves eligible members + their FCM tokens at publish time.
 */

async function resolve(organizationId, audienceType, targetIds = []) {
  switch (audienceType) {
    case 'all':
      return { type: 'topic', topic: 'notices_all' };

    case 'ward': {
      if (!targetIds || targetIds.length === 0) {
        return { type: 'topic', topic: 'notices_all' };
      }
      // Send to first ward topic if single, otherwise token-batch resolve members in those wards
      if (targetIds.length === 1) {
        return { type: 'topic', topic: `ward_${targetIds[0]}` };
      }
      // Multiple wards → resolve member tokens
      return await resolveMemberTokensFromHouseholds(organizationId, null, targetIds);
    }

    case 'household': {
      if (!targetIds || targetIds.length === 0) {
        return { type: 'topic', topic: 'notices_all' };
      }
      if (targetIds.length === 1) {
        return { type: 'topic', topic: `household_${targetIds[0]}` };
      }
      return await resolveMemberTokensFromHouseholds(organizationId, targetIds, null);
    }

    case 'committee':
      return await resolveCommitteeTokens(organizationId, targetIds);

    case 'payment_monthly':
      return await resolvePaymentTokens(organizationId, 'MONTHLY', null);

    case 'payment_recurring':
      return await resolvePaymentTokens(organizationId, null, ['ACTIVE']);

    case 'payment_lapsed':
      return await resolvePaymentTokens(organizationId, null, ['PAST_DUE', 'UNPAID']);

    default:
      logger.warn(`[AudienceResolver] Unknown audienceType: ${audienceType}`);
      return { type: 'topic', topic: 'notices_all' };
  }
}

/**
 * Resolve FCM tokens for committee members.
 * targetIds = committeeIds to target (all active committees if empty)
 */
async function resolveCommitteeTokens(organizationId, targetIds) {
  const filter = {
    organizationId,
    isExternal: false,
    status: 'active',
  };
  if (targetIds && targetIds.length > 0) {
    filter.committeeId = { $in: targetIds };
  }

  const committeeMembers = await CommitteeMember.find(filter).select('memberId').lean();
  const memberIds = committeeMembers.map(cm => cm.memberId).filter(Boolean);
  return await resolveMemberTokensFromIds(memberIds);
}

/**
 * Resolve FCM tokens for members based on subscription payment status.
 * @param {string|null} frequency — 'MONTHLY', 'RECURRING', etc. (null = any recurring)
 * @param {string[]|null} billingStatuses — ['ACTIVE'] | ['PAST_DUE', 'UNPAID']
 */
async function resolvePaymentTokens(organizationId, frequency, billingStatuses) {
  // Step 1: Find matching FeePlans
  const planFilter = { organizationId, isDeleted: false };
  if (frequency) {
    planFilter.frequency = frequency;
    planFilter.type = 'RECURRING';
  } else {
    planFilter.type = 'RECURRING';
  }
  const plans = await FeePlan.find(planFilter).select('_id').lean();
  const planIds = plans.map(p => p._id);

  if (planIds.length === 0) return { type: 'tokens', tokens: [], tokenToMemberMap: new Map() };

  // Step 2: Find subscriptions matching those plans + billing status
  const subFilter = {
    organizationId,
    planId: { $in: planIds },
    isDeleted: false,
  };
  if (billingStatuses && billingStatuses.length > 0) {
    subFilter.billingStatus = { $in: billingStatuses };
  }

  const subscriptions = await Subscription.find(subFilter).select('targetId targetType').lean();

  // Extract member IDs (direct members + household head members)
  const memberIds = [];
  const householdIds = [];

  for (const sub of subscriptions) {
    if (sub.targetType === 'MEMBER') {
      memberIds.push(sub.targetId);
    } else {
      householdIds.push(sub.targetId);
    }
  }

  // Resolve household heads into member IDs
  if (householdIds.length > 0) {
    const Household = require('../models/Household');
    const households = await Household.find({
      _id: { $in: householdIds },
      isDeleted: false,
    }).select('headMemberId').lean();
    households.forEach(h => { if (h.headMemberId) memberIds.push(h.headMemberId); });
  }

  return await resolveMemberTokensFromIds(memberIds);
}

/**
 * Resolve FCM tokens from household or ward groupings.
 */
async function resolveMemberTokensFromHouseholds(organizationId, householdIds, wardIds) {
  const filter = { organizationId, isDeleted: false };
  if (householdIds && householdIds.length > 0) {
    filter._id = { $in: householdIds };
  }
  // Note: wardId is stored as regionId/zoneId in Household — adapt as needed
  const Household = require('../models/Household');
  const households = await Household.find(filter).select('headMemberId').lean();
  const memberIds = households.map(h => h.headMemberId).filter(Boolean);
  return await resolveMemberTokensFromIds(memberIds);
}

/**
 * Given a list of memberIds, collect all their FCM tokens.
 * Deduplicates tokens and builds a tokenToMemberMap for stale cleanup.
 */
async function resolveMemberTokensFromIds(memberIds) {
  if (!memberIds || memberIds.length === 0) {
    return { type: 'tokens', tokens: [], tokenToMemberMap: new Map() };
  }

  // Deduplicate memberIds
  const uniqueMemberIds = [...new Set(memberIds.map(id => id.toString()))];

  const members = await Member.find({
    _id: { $in: uniqueMemberIds },
    isDeleted: false,
    status: 'active',
  }).select('fcmTokens').lean();

  const tokens = [];
  const tokenToMemberMap = new Map();

  for (const member of members) {
    if (!member.fcmTokens || member.fcmTokens.length === 0) continue;
    for (const tokenEntry of member.fcmTokens) {
      if (tokenEntry.token) {
        tokens.push(tokenEntry.token);
        tokenToMemberMap.set(tokenEntry.token, member._id);
      }
    }
  }

  logger.info(`[AudienceResolver] Resolved ${tokens.length} token(s) from ${members.length} member(s)`);
  return { type: 'tokens', tokens, tokenToMemberMap };
}

module.exports = { resolve };
