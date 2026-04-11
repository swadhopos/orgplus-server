const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const IStorageProvider = require('./IStorageProvider');

/**
 * R2StorageProvider — Cloudflare R2 storage (default production provider).
 *
 * R2 is S3-compatible, so we use the AWS SDK v3 with a custom endpoint.
 *
 * Required env vars:
 *   R2_ACCOUNT_ID     — Cloudflare account ID
 *   R2_ACCESS_KEY_ID  — R2 API token key ID
 *   R2_SECRET_ACCESS_KEY — R2 API token secret
 *   R2_BUCKET_NAME    — bucket name
 *   R2_PUBLIC_URL     — public bucket URL (e.g. https://pub-xxx.r2.dev or custom domain)
 */
class R2StorageProvider extends IStorageProvider {
  constructor() {
    super();
    this.bucket = process.env.R2_BUCKET_NAME;
    this.publicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
  }

  async upload(buffer, key, mimeType) {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }));
    const url = `${this.publicUrl}/${key}`;
    return { url, key };
  }

  async delete(key) {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
  }
}

module.exports = R2StorageProvider;
