require('dotenv').config();
const storage = require('../src/services/storage');
const logger = require('../src/utils/logger');

async function testActualUpload() {
  console.log('--- Cloudflare R2 Live Upload Test ---');
  
  const testKey = `orgplus-logos/test-connection-${Date.now()}.txt`;
  const testContent = Buffer.from('Cloudflare R2 Connection Test - ' + new Date().toISOString());
  const mimeType = 'text/plain';

  try {
    console.log('Target Bucket:', process.env.R2_BUCKET_NAME);
    console.log('Target Key:', testKey);
    console.log('Attempting upload...');

    const result = await storage.upload(testContent, testKey, mimeType);
    
    console.log('\n✅ Upload Successful!');
    console.log('Generated Key:', result.key);
    console.log('Public URL:', result.url);
    
    console.log('\nAttempting to delete test file...');
    await storage.delete(testKey);
    console.log('✅ Delete Successful!');
    
    console.log('\n--- Test Passed ---');
  } catch (err) {
    console.error('\n❌ Upload Test Failed!');
    console.error('Error details:', err.message);
    if (err.$metadata) {
      console.error('Account ID / Endpoint issues likely if status is 403 or 404.');
    }
    process.exit(1);
  }
}

testActualUpload();
