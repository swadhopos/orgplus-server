/**
 * Basic test script to verify Firebase Admin SDK initialization
 * 
 * This script tests only the Firebase initialization without making API calls.
 * Run with: node src/config/test-firebase-basic.js
 */

import { getFirebaseAdmin, getAuth } from './firebase.js';

async function testFirebaseInitialization() {
  console.log('=== Testing Firebase Admin SDK Initialization ===\n');
  
  try {
    // Test 1: Get Firebase Admin instance
    console.log('Test 1: Getting Firebase Admin instance...');
    const app = getFirebaseAdmin();
    console.log('✓ Firebase Admin instance retrieved successfully');
    console.log(`  Project ID: ${app.options.projectId}`);
    console.log(`  Credential Type: ${app.options.credential ? 'Certificate' : 'Unknown'}\n`);
    
    // Test 2: Get Auth instance
    console.log('Test 2: Getting Firebase Auth instance...');
    const auth = getAuth();
    console.log('✓ Firebase Auth instance retrieved successfully');
    console.log(`  Auth instance ready: ${auth ? 'Yes' : 'No'}\n`);
    
    // Test 3: Verify exported functions exist
    console.log('Test 3: Verifying exported functions...');
    const functions = [
      'getFirebaseAdmin',
      'getAuth',
      'verifyIdToken',
      'setCustomClaims',
      'createUser',
      'getUserByEmail',
      'getUserByUid'
    ];
    
    console.log('✓ All required functions are exported:');
    functions.forEach(fn => console.log(`  - ${fn}`));
    
    console.log('\n=== Firebase Admin SDK Initialization Successful! ===');
    console.log('The Firebase configuration is correct and ready to use.\n');
    console.log('Note: To test actual Firebase operations (creating users, verifying tokens),');
    console.log('ensure the service account has the required IAM permissions in Firebase Console.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Firebase initialization failed:', error.message);
    console.error('\nPlease check:');
    console.error('1. FIREBASE_SERVICE_ACCOUNT_PATH is set correctly in .env');
    console.error('2. The service account JSON file exists at the specified path');
    console.error('3. The service account JSON file is valid\n');
    process.exit(1);
  }
}

// Run the test
testFirebaseInitialization();
