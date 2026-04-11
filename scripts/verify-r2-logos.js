require('dotenv').config();
const storage = require('../src/services/storage');
const path = require('path');

async function testStorageConfig() {
  console.log('--- Storage Configuration Test ---');
  console.log('STORAGE_PROVIDER:', process.env.STORAGE_PROVIDER);
  console.log('R2_BUCKET_NAME:', process.env.R2_BUCKET_NAME);
  console.log('R2_PUBLIC_URL:', process.env.R2_PUBLIC_URL);
  console.log('R2_ACCOUNT_ID is set:', !!process.env.R2_ACCOUNT_ID);
  console.log('R2_ACCESS_KEY_ID is set:', !!process.env.R2_ACCESS_KEY_ID);
  console.log('R2_SECRET_ACCESS_KEY is set:', !!process.env.R2_SECRET_ACCESS_KEY);

  console.log('\n--- Logo Path Test ---');
  const orgId = 'org_abc123';
  const mockUuid = 'uuid_456';
  const ext = '.png';
  const expectedPrefix = 'orgplus-logos/';
  const expectedKey = `${expectedPrefix}${orgId}/logo_${mockUuid}${ext}`;

  console.log('Example Organization ID:', orgId);
  console.log('Expected Prefix:', expectedPrefix);
  console.log('Generated Key format would be:', expectedKey);
  
  if (process.env.R2_PUBLIC_URL) {
    const expectedUrl = `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${expectedKey}`;
    console.log('Expected Public URL:', expectedUrl);
  } else {
    console.log('R2_PUBLIC_URL is not set, cannot generate example URL.');
  }

  console.log('\n--- Script finished ---');
}

testStorageConfig().catch(console.error);
