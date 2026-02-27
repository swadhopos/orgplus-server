/**
 * Script to get Firebase ID token for testing API endpoints
 * This simulates what the frontend does when a user logs in
 */

require('dotenv').config();
const { admin } = require('../src/config/firebase');

const getCustomToken = async () => {
  const email = 'nksuhail13@gmail.com';
  
  try {
    console.log(`\nGetting custom token for: ${email}`);
    
    // Get user by email
    const user = await admin.auth().getUserByEmail(email);
    
    console.log(`\n✅ User found:`);
    console.log(`   User ID: ${user.uid}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Custom Claims:`, user.customClaims);
    
    // Create custom token
    const customToken = await admin.auth().createCustomToken(user.uid);
    
    console.log(`\n✅ Custom Token Generated:`);
    console.log(customToken);
    
    console.log(`\n📝 To get ID token, use this curl command:`);
    console.log(`\ncurl -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.VITE_FIREBASE_API_KEY || 'YOUR_API_KEY'}" \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d "{\\"token\\":\\"${customToken}\\",\\"returnSecureToken\\":true}"`);
    
    console.log(`\n📝 Or use this PowerShell command:`);
    console.log(`\n$body = @{`);
    console.log(`  token = "${customToken}"`);
    console.log(`  returnSecureToken = $true`);
    console.log(`} | ConvertTo-Json`);
    console.log(`\nInvoke-RestMethod -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=AIzaSyBgBGuxZ3rTzFJMMmP2yl8_GAqZjQi2eo0" -Method POST -Body $body -ContentType "application/json" | Select-Object idToken`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

getCustomToken();
