const admin = require('firebase-admin');
const dotenv = require('dotenv');
const { readFileSync } = require('fs');
const { resolve } = require('path');

dotenv.config();

/**
 * Initialize Firebase Admin SDK
 * 
 * This module initializes the Firebase Admin SDK for backend authentication.
 * It supports two configuration methods:
 * 1. Service account file path (recommended for production)
 * 2. Individual environment variables (for containerized deployments)
 */

let firebaseApp;

try {
  // Check if Firebase is already initialized
  if (admin.apps.length === 0) {
    // Method 1: Use service account file path
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ? resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH) : null;
    const fs = require('fs');
    const hasServiceAccountFile = serviceAccountPath && fs.existsSync(serviceAccountPath);

    if (hasServiceAccountFile) {
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      
      console.log(`Firebase Admin SDK initialized with service account: ${serviceAccount.project_id}`);
    }
    // Method 2: Use individual environment variables
    else if (process.env.FIREBASE_PROJECT_ID && 
             process.env.FIREBASE_PRIVATE_KEY && 
             process.env.FIREBASE_CLIENT_EMAIL) {
      
      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL
      };
      
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.projectId
      });
      
      console.log(`Firebase Admin SDK initialized with environment variables: ${serviceAccount.projectId}`);
    }
    // No configuration found
    else {
      const errorMsg = hasServiceAccountFile ? '' : `Service account file not found at: ${serviceAccountPath}\n`;
      throw new Error(
        'Firebase configuration not found. ' + errorMsg + 'Please provide either:\n' +
        '1. A valid FIREBASE_SERVICE_ACCOUNT_PATH environment variable, or\n' +
        '2. FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL environment variables'
      );
    }
  } else {
    firebaseApp = admin.app();
    console.log('Firebase Admin SDK already initialized');
  }
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK:', error.message);
  throw error;
}

/**
 * Get Firebase Admin instance
 * @returns {admin.app.App} Firebase Admin app instance
 */
const getFirebaseAdmin = () => {
  if (!firebaseApp) {
    throw new Error('Firebase Admin SDK not initialized');
  }
  return firebaseApp;
};

/**
 * Get Firebase Auth instance
 * @returns {admin.auth.Auth} Firebase Auth instance
 */
const getAuth = () => {
  return admin.auth();
};

/**
 * Verify Firebase ID token
 * @param {string} idToken - Firebase ID token from client
 * @returns {Promise<admin.auth.DecodedIdToken>} Decoded token with user info and custom claims
 */
const verifyIdToken = async (idToken) => {
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
};

/**
 * Set custom claims for a user
 * @param {string} uid - Firebase user ID
 * @param {Object} claims - Custom claims object (e.g., { role: 'admin', orgId: '123' })
 * @returns {Promise<void>}
 */
const setCustomClaims = async (uid, claims) => {
  try {
    await admin.auth().setCustomUserClaims(uid, claims);
    console.log(`Custom claims set for user ${uid}:`, claims);
  } catch (error) {
    throw new Error(`Failed to set custom claims: ${error.message}`);
  }
};

/**
 * Create a new Firebase user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<admin.auth.UserRecord>} Created user record
 */
const createUser = async (email, password) => {
  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
      emailVerified: false
    });
    console.log(`Firebase user created: ${userRecord.uid} (${email})`);
    return userRecord;
  } catch (error) {
    throw new Error(`Failed to create user: ${error.message}`);
  }
};

/**
 * Get user by email
 * @param {string} email - User email
 * @returns {Promise<admin.auth.UserRecord>} User record
 */
const getUserByEmail = async (email) => {
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    return userRecord;
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return null;
    }
    throw new Error(`Failed to get user by email: ${error.message}`);
  }
};

/**
 * Get user by UID
 * @param {string} uid - Firebase user ID
 * @returns {Promise<admin.auth.UserRecord>} User record
 */
const getUserByUid = async (uid) => {
  try {
    const userRecord = await admin.auth().getUser(uid);
    return userRecord;
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return null;
    }
    throw new Error(`Failed to get user by UID: ${error.message}`);
  }
};

// Export all functions
module.exports = {
  getFirebaseAdmin,
  getAuth,
  verifyIdToken,
  setCustomClaims,
  createUser,
  getUserByEmail,
  getUserByUid,
  admin
};
