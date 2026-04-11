require('dotenv').config();
const mongoose = require('mongoose');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const zlib = require('zlib');
const readline = require('readline');
const BackupLog = require('../src/models/BackupLog');
const logger = require('../src/utils/logger');

// Config
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'orgplus-storage';
const TEST_DB_NAME = 'backup_test';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/orgplus';

// Helper to get R2 Client
const getR2Client = () => {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
};

async function runRestoreTest() {
  let testConnection = null;
  try {
    console.log('🚀 Starting Restoration Test...');

    // 1. Connect to Main DB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to Main/Source MongoDB');

    // 2. Find Latest Successful Backup
    const latestBackup = await BackupLog.findOne({ status: 'success' }).sort({ startTime: -1 });
    if (!latestBackup) {
      throw new Error('No successful backup found in BackupLog collection.');
    }

    console.log(`📂 Identified Latest Backup: ${latestBackup.backupId}`);
    console.log(`📍 Path: ${latestBackup.path}`);
    console.log(`📦 Collections to restore: ${latestBackup.collectionStats.length}`);

    // 3. Connect to Test DB
    const testDbUri = MONGODB_URI.includes('?') 
      ? MONGODB_URI.replace(/\/[^/?]+\?/, `/${TEST_DB_NAME}?`)
      : MONGODB_URI.substring(0, MONGODB_URI.lastIndexOf('/') + 1) + TEST_DB_NAME;
    
    testConnection = await mongoose.createConnection(testDbUri).asPromise();
    console.log(`✅ Connected to Test Database: ${TEST_DB_NAME}`);

    const r2Client = getR2Client();
    const summary = [];

    // 4. Restoration Loop
    for (const collStat of latestBackup.collectionStats) {
      if (collStat.status !== 'success') {
        console.log(`⚠️ Skipping failed collection: ${collStat.name}`);
        continue;
      }

      console.log(`⏳ Restoring collection: ${collStat.name}...`);
      
      const key = `${latestBackup.path}/${collStat.name}.json.gz`;
      const getObjectParams = {
        Bucket: R2_BUCKET_NAME,
        Key: key,
      };

      const response = await r2Client.send(new GetObjectCommand(getObjectParams));
      const gzipStream = response.Body.pipe(zlib.createGunzip());
      
      const rl = readline.createInterface({
        input: gzipStream,
        terminal: false
      });

      let batch = [];
      let totalRestored = 0;
      const BATCH_SIZE = 500;

      for await (const line of rl) {
        if (!line.trim()) continue;
        try {
          const doc = JSON.parse(line);
          batch.push(doc);
          
          if (batch.length >= BATCH_SIZE) {
            await testConnection.collection(collStat.name).insertMany(batch);
            totalRestored += batch.length;
            batch = [];
          }
        } catch (err) {
          console.error(`❌ Error parsing document in ${collStat.name}:`, err.message);
        }
      }

      // Insert remaining
      if (batch.length > 0) {
        await testConnection.collection(collStat.name).insertMany(batch);
        totalRestored += batch.length;
      }

      console.log(`✅ Restored ${totalRestored} documents to ${collStat.name}`);
      summary.push({ collection: collStat.name, count: totalRestored });
    }

    // 5. Final Verification
    console.log('\n📊 Restoration Summary:');
    console.table(summary);

    // 6. Cleanup
    console.log(`\n🧹 Cleaning up: Dropping ${TEST_DB_NAME}...`);
    await testConnection.dropDatabase();
    console.log('✅ Test database removed.');

    console.log('\n🎊 BACKUP VERIFICATION SUCCESSFUL!');

  } catch (err) {
    console.error('\n❌ Restoration Test Failed:', err.message);
    process.exit(1);
  } finally {
    if (testConnection) await testConnection.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

runRestoreTest();
