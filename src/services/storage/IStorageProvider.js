/**
 * IStorageProvider — Storage provider interface (contract)
 *
 * All storage implementations must implement these methods.
 * Switch provider by setting STORAGE_PROVIDER env var: r2 | s3 | local
 */

class IStorageProvider {
  /**
   * Upload a file buffer and return its public URL.
   * @param {Buffer} buffer — file data
   * @param {string} key — storage key / path (e.g. 'notices/abc123.jpg')
   * @param {string} mimeType — MIME type (e.g. 'image/jpeg')
   * @returns {Promise<{ url: string, key: string }>}
   */
  async upload(buffer, key, mimeType) {
    throw new Error('upload() not implemented');
  }

  /**
   * Delete a file by its storage key.
   * @param {string} key
   * @returns {Promise<void>}
   */
  async delete(key) {
    throw new Error('delete() not implemented');
  }
}

module.exports = IStorageProvider;
