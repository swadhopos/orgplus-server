const path = require('path');
const fs = require('fs').promises;
const IStorageProvider = require('./IStorageProvider');

/**
 * LocalStorageProvider — stores files on the local filesystem.
 * Used for development / testing only.
 *
 * Files are saved to: <project_root>/uploads/<key>
 * PUBLIC_BASE_URL env var is used to build the public URL.
 */
class LocalStorageProvider extends IStorageProvider {
  constructor() {
    super();
    this.baseDir = path.resolve(process.cwd(), 'uploads');
    this.baseUrl = (process.env.PUBLIC_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
  }

  async upload(buffer, key, mimeType) {
    const filePath = path.join(this.baseDir, key);
    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    const url = `${this.baseUrl}/uploads/${key}`;
    return { url, key };
  }

  async delete(key) {
    const filePath = path.join(this.baseDir, key);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err; // Ignore if file not found
    }
  }
}

module.exports = LocalStorageProvider;
