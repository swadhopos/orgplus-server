const admin = require('firebase-admin');
const logger = require('../utils/logger');

/**
 * fcmService — Firebase Cloud Messaging wrapper
 *
 * Supports:
 *  - Topic-based sends (all members, ward, household)
 *  - Token-batch sends (committee, payment-based)
 *
 * Auto-cleans invalid tokens from the Member collection.
 *
 * Requires:
 *   FIREBASE_SERVICE_ACCOUNT env var: JSON string of the Firebase service account key
 *   Or: FIREBASE_SERVICE_ACCOUNT_PATH: path to the service account JSON file
 */

function getFirebaseApp() {
  if (admin.apps.length > 0) return admin.apps[0];

  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    credential = admin.credential.cert(serviceAccount);
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    credential = admin.credential.cert(serviceAccount);
  } else {
    throw new Error('Firebase credentials not configured. Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_PATH env var.');
  }

  return admin.initializeApp({ credential });
}

/**
 * Send to a FCM topic (e.g. 'notices_all', 'ward_<id>', 'household_<id>')
 */
async function sendToTopic(topic, title, body, data = {}) {
  const app = getFirebaseApp();
  const message = {
    topic,
    notification: { title, body },
    data: { ...data, timestamp: Date.now().toString() },
    webpush: {
      notification: {
        title,
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        requireInteraction: true,
      },
      fcmOptions: {
        link: data.link || '/',
      },
    },
  };

  const response = await admin.messaging(app).send(message);
  logger.info(`[FCM] Sent to topic "${topic}": ${response}`);
  return response;
}

/**
 * Send to a batch of FCM tokens (committee / payment audience).
 * Automatically removes stale/invalid tokens from Member collection.
 * FCM allows max 500 tokens per batch — this handles chunking.
 *
 * @param {string[]} tokens — array of FCM tokens
 * @param {string} title
 * @param {string} body
 * @param {Object} data — extra data payload
 * @param {Map<string, ObjectId>} tokenToMemberMap — token → memberId (for cleanup)
 */
async function sendToTokens(tokens, title, body, data = {}, tokenToMemberMap = new Map()) {
  if (!tokens || tokens.length === 0) {
    logger.warn('[FCM] sendToTokens called with empty token list');
    return { successCount: 0, failureCount: 0 };
  }

  const app = getFirebaseApp();
  const CHUNK_SIZE = 500;
  let totalSuccess = 0;
  let totalFailure = 0;
  const invalidTokens = [];

  const baseMessage = {
    notification: { title, body },
    data: { ...data, timestamp: Date.now().toString() },
    webpush: {
      notification: {
        title,
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        requireInteraction: true,
      },
      fcmOptions: {
        link: data.link || '/',
      },
    },
  };

  // Send in chunks of 500 (Sequential to keep server load low)
  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + CHUNK_SIZE);
    const multicastMessage = { ...baseMessage, tokens: chunk };

    try {
      const response = await admin.messaging(app).sendEachForMulticast(multicastMessage);
      totalSuccess += response.successCount;
      totalFailure += response.failureCount;

      // Collect invalid tokens
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(chunk[idx]);
          }
        }
      });
    } catch (chunkErr) {
      logger.error(`[FCM] Error sending chunk at index ${i}:`, chunkErr);
      totalFailure += chunk.length;
    }
  }



  // Clean up invalid tokens from Member collection
  if (invalidTokens.length > 0) {
    await cleanupInvalidTokens(invalidTokens, tokenToMemberMap);
  }

  logger.info(`[FCM] Batch send complete: ${totalSuccess} success, ${totalFailure} failure`);
  return { successCount: totalSuccess, failureCount: totalFailure };
}

/**
 * Remove stale FCM tokens from Member documents
 */
async function cleanupInvalidTokens(invalidTokens, tokenToMemberMap) {
  const Member = require('../models/Member');
  try {
    await Member.updateMany(
      { 'fcmTokens.token': { $in: invalidTokens } },
      { $pull: { fcmTokens: { token: { $in: invalidTokens } } } }
    );
    logger.info(`[FCM] Cleaned up ${invalidTokens.length} invalid token(s)`);
  } catch (err) {
    logger.error('[FCM] Failed to clean up invalid tokens:', err);
  }
}

module.exports = { sendToTopic, sendToTokens };
