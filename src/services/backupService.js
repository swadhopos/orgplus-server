const mongoose = require('mongoose');
const cron = require('node-cron');
const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { Readable, PassThrough } = require('stream');
const zlib = require('zlib');
const logger = require('../utils/logger');
const BackupLog = require('../models/BackupLog');

/**
 * BackupService
 * Manages automated MongoDB backups to Cloudflare R2 using streaming and compression.
 */
class BackupService {
  constructor() {
    this.bucket = process.env.R2_BUCKET_NAME;
    this.env = process.env.BACKUP_ENV || 'dev';
    this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '2');
    this.intervalHours = parseInt(process.env.BACKUP_INTERVAL_HOURS || '7');

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
  }

  /**
   * Initializes the cron scheduler
   */
  init() {
    const cronExpression = `0 */${this.intervalHours} * * *`;
    cron.schedule(cronExpression, () => {
      logger.info(`[BackupService] Starting scheduled backup (Env: ${this.env})`);
      this.runFullBackup().catch(err => logger.error('[BackupService] Scheduled backup failed:', err));
    });

    logger.info(`[BackupService] Backup scheduler initialized. Interval: every ${this.intervalHours} hours.`);
  }

  /**
   * Executes a full streaming backup of all collections
   */
  async runFullBackup() {
    const backupId = `backup_${this.env}_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const timestamp = new Date();
    const dateFolder = timestamp.toISOString().split('T')[0];
    const backupPath = `backups/${this.env}/${dateFolder}/${backupId}`;

    const log = await BackupLog.create({
      env: this.env,
      backupId,
      path: backupPath,
      status: 'running',
    });

    let totalBytes = 0;
    const stats = [];

    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name).filter(name => name !== 'backuplogs');

      for (const colName of collectionNames) {
        try {
          const result = await this.backupCollection(colName, backupPath);
          stats.push({ name: colName, size: result.size, status: 'success' });
          totalBytes += result.size;
        } catch (colErr) {
          logger.error(`[BackupService] Failed to backup collection ${colName}:`, colErr);
          stats.push({ name: colName, status: 'failed', error: colErr.message });
        }
      }

      log.status = 'success';
      log.totalSize = totalBytes;
      log.collectionStats = stats;
      log.endTime = new Date();
      await log.save();

      logger.info(`[BackupService] Backup ${backupId} completed successfully. Total size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

      // Run retention cleanup
      await this.cleanupOldBackups();

    } catch (err) {
      log.status = 'failed';
      log.errorMessage = err.message;
      log.endTime = new Date();
      await log.save();
      throw err;
    }
  }

  /**
   * Streams a single collection to R2
   */
  async backupCollection(collectionName, basePath) {
    const key = `${basePath}/${collectionName}.json.gz`;
    const cursor = mongoose.connection.db.collection(collectionName).find();
    
    // Create a readable stream for NDJSON
    const readable = new Readable({
      async read() {
        try {
          const doc = await cursor.next();
          if (doc === null) {
            this.push(null);
          } else {
            this.push(JSON.stringify(doc) + '\n');
          }
        } catch (err) {
          this.destroy(err);
        }
      }
    });

    const gzip = zlib.createGzip();
    const uploadStream = readable.pipe(gzip);

    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: uploadStream,
        ContentType: 'application/gzip',
      },
    });

    await upload.done();
    
    // We don't easily get the final compressed size back from Upload.done()
    // but we can assume success if no error. We'll mark size as 0 or use headObject if needed.
    // For minimal memory, we avoid manual buffering to calculate size.
    return { size: 0 }; 
  }

  /**
   * Deletes backups older than retentionDays
   */
  async cleanupOldBackups() {
    try {
      const prefix = `backups/${this.env}/`;
      const listCmd = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
      });

      const data = await this.s3.send(listCmd);
      if (!data.Contents || data.Contents.length === 0) return;

      const now = new Date();
      const retentionMs = this.retentionDays * 24 * 60 * 60 * 1000;

      // Group by "folder" (third part of the key)
      const toDelete = data.Contents.filter(obj => {
        const age = now - new Date(obj.LastModified);
        return age > retentionMs;
      });

      if (toDelete.length > 0) {
        logger.info(`[BackupService] Cleaning up ${toDelete.length} old objects from R2...`);
        const deleteCmd = new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: {
            Objects: toDelete.map(obj => ({ Key: obj.Key })),
          },
        });
        await this.s3.send(deleteCmd);
      }
    } catch (err) {
      logger.error('[BackupService] Cleanup failed:', err);
    }
  }
}

module.exports = new BackupService();
