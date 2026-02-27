/**
 * Script to verify system admin user and reset password if needed
 */

require('dotenv').config();
const { getUserByEmail, admin } = require('../src/config/firebase');

const verifyAndResetUser = async () => {
  const email = 'nksuhail13@gmail.com';
  const newPassword = 'ChangeThisPassword123!';
  
  try {
    console.log(`\nVerifying user: ${email}`);
    
    const user = await getUserByEmail(email);
    
    if (!user) {
      console.log('❌ User not found!');
      return;
    }
    
    console.log('\n✅ User found:');
    console.log(`   User ID: ${user.uid}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Email Verified: ${user.emailVerified}`);
    console.log(`   Disabled: ${user.disabled}`);
    console.log(`   Custom Claims:`, user.customClaims);
    
    // Update password
    console.log(`\n🔄 Updating password...`);
    await admin.auth().updateUser(user.uid, {
      password: newPassword,
      emailVerified: true
    });
    
    console.log('✅ Password updated successfully!');
    console.log(`\nYou can now login with:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${newPassword}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

verifyAndResetUser();
