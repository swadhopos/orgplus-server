/**
 * Storage factory — returns the correct provider based on STORAGE_PROVIDER env var.
 *
 * STORAGE_PROVIDER=r2     → Cloudflare R2 (default, production)
 * STORAGE_PROVIDER=local  → Local filesystem (development)
 *
 * Usage:
 *   const storage = require('./services/storage');
 *   const { url, key } = await storage.upload(buffer, 'notices/abc.jpg', 'image/jpeg');
 *   await storage.delete(key);
 */

let _instance = null;

function getProvider() {
  if (_instance) return _instance;

  const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();

  switch (provider) {
    case 'r2': {
      const R2StorageProvider = require('./R2StorageProvider');
      _instance = new R2StorageProvider();
      break;
    }
    case 'local':
    default: {
      const LocalStorageProvider = require('./LocalStorageProvider');
      _instance = new LocalStorageProvider();
      break;
    }
  }

  return _instance;
}

module.exports = {
  upload: (buffer, key, mimeType) => getProvider().upload(buffer, key, mimeType),
  delete: (key) => getProvider().delete(key),
};
