/**
 * Test script to verify Firebase Admin SDK configuration
 * 
 * This script tests the Firebase connection and basic operations.
 * Run with: node src/config/test-firebase.js
 */

import { getFirebaseAdmin, getAuth, verifyIdToken, getUserByEmail } from './firebase.js';

async function testFirebaseConnection() {
  console.log('=== Testing Firebase Admin SDK Configuration ===\n');
  
  try {
    // Test 1: Get Firebase Admin instance
    console.log('Test 1: Getting Firebase Admin instance...');
    const app = getFirebaseAdmin();
    console.log('✓ Firebase Admin instance retrieved successfully');
    console.log(`  Project ID: ${app.options.projectId}\n`);
    
    // Test 2: Get Auth instance
    console.log('Test 2: Getting Firebase Auth instance...');
    const auth = getAuth();
    console.log('✓ Firebase Auth instance retrieved successfully\n');
    
    // Test 3: List users (to verify connection)
    console.log('Test 3: Testing connection by listing users...');
    const listUsersResult = await auth.listUsers(1);
    console.log('✓ Successfully connected to Firebase Auth');
    console.log(`  Total users in project: ${listUsersResult.users.length > 0 ? 'at least 1' : '0'}\n`);
    
    // Test 4: Check for bootstrap user
    console.log('Test 4: Checking for bootstrap user (nksuhail13@gmail.com)...');
    try {
      const bootstrapUser = await getUserByEmail('nksuhail13@gmail.com');
      if (bootstrapUser) {
        console.log('✓ Bootstrap user found');
        console.log(`  UID: ${bootstrapUser.uid}`);
        console.log(`  Email: ${bootstrapUser.email}`);
        console.log(`  Custom Claims:`, bootstrapUser.customClaims || 'None');
      } else {
        console.log('ℹ Bootstrap user not found (this is expected if bootstrap hasn\'t been run yet)');
      }
    } catch (error) {
      console.log('ℹ Bootstrap user not found (this is expected if bootstrap hasn\'t been run yet)');
    }
    
    console.log('\n=== All Firebase tests passed! ===');
    console.log('Firebase Admin SDK is properly configured and connected.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Firebase test failed:', error.message);
    console.error('\nPlease check:');
    console.error('1. FIREBASE_SERVICE_ACCOUNT_PATH is set correctly in .env');
    console.error('2. The service account JSON file exists and is valid');
    console.error('3. The service account has proper permissions\n');
    process.exit(1);
  }
}

// Run the test
testFirebaseConnection();
