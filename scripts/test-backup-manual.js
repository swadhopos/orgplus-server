require('dotenv').config();
const mongoose = require('mongoose');
const backupService = require('../src/services/backupService');
const BackupLog = require('../src/models/BackupLog');

async function testManualBackup() {
  console.log('--- Manual Backup Test ---');
  console.log(`Environment: ${process.env.BACKUP_ENV || 'dev'}`);
  console.log(`Target Bucket: ${process.env.R2_BUCKET_NAME}`);

  try {
    console.log('Attempting to connect to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected.');

    console.log('Triggering manual backup run...');
    console.log('(This may take a minute depending on database size)');
    
    await backupService.runFullBackup();

    console.log('\n--- Test Result ---');
    const latestLog = await BackupLog.findOne({ env: process.env.BACKUP_ENV || 'dev' }).sort({ createdAt: -1 });
    
    if (latestLog && latestLog.status === 'success') {
      console.log('✅ Backup Test Passed!');
      console.log(`Backup ID: ${latestLog.backupId}`);
      console.log(`R2 Path: ${latestLog.path}`);
      console.log(`Total Size: ${(latestLog.totalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Collections Backed Up: ${latestLog.collectionStats.length}`);
    } else {
      console.log('❌ Backup Test Failed!');
      if (latestLog) {
        console.log(`Status: ${latestLog.status}`);
        console.log(`Error: ${latestLog.errorMessage}`);
      }
    }

  } catch (err) {
    console.error('❌ Test encountered an error:', err);
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed.');
  }
}

testManualBackup();
