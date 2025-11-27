/**
 * ResumableUploadManager - Handles chunked uploads with resume capability
 */
class ResumableUploadManager {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 5 * 1024 * 1024; // 5MB
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.chunkDelay = options.chunkDelay || 0; // Delay between chunks (ms)
    this.uploadId = null;
    this.onProgress = options.onProgress || (() => {});
    this.onChunkComplete = options.onChunkComplete || (() => {});
    this.onError = options.onError || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.csrfToken = null;
    this.sessionHealthChecked = false;
  }

  /**
   * Check session health before uploading chunks
   */
  async checkSessionHealth(csrfToken = null) {
    // Skip if already checked once in this upload
    if (this.sessionHealthChecked) {
      return true;
    }

    try {
      // Use a minimal endpoint that requires auth but won't modify state
      const response = await fetch('/health', {
        method: 'GET',
        credentials: 'same-origin'
      });

      // If health check returns 200, session is alive
      if (response.ok) {
        this.sessionHealthChecked = true;
        console.log('Session health check passed');
        return true;
      }

      // If redirect or auth error, session is dead
      if (response.status === 401 || response.redirected) {
        console.error('Session health check failed: auth lost');
        throw new Error('AUTH_REQUIRED');
      }

      return true;
    } catch (error) {
      console.error('Session health check error:', error);
      // If health check itself fails (network, etc), allow upload to proceed once
      // This prevents blocking uploads due to transient network issues
      return true;
    }
  }

  /**
   * Calculate file hash (SHA-256)
   */
  async calculateFileHash(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const chunkSize = 64 * 1024; // 64KB chunks for hashing
      let offset = 0;
      const chunks = [];

      reader.onload = async (e) => {
        chunks.push(new Uint8Array(e.target.result));
        offset += chunkSize;

        if (offset < file.size) {
          const chunk = file.slice(offset, offset + chunkSize);
          reader.readAsArrayBuffer(chunk);
        } else {
          try {
            const combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
            let pos = 0;
            for (const chunk of chunks) {
              combined.set(chunk, pos);
              pos += chunk.length;
            }

            const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            resolve(hashHex);
          } catch (error) {
            reject(error);
          }
        }
      };

      reader.onerror = reject;

      const chunk = file.slice(0, chunkSize);
      reader.readAsArrayBuffer(chunk);
    });
  }

  /**
   * Start resumable upload
   */
  async startUpload(file, baseUrl, csrfToken = null) {
    try {
      // CRITICAL: Always use HTTP on localhost/127.0.0.1 to avoid HSTS forcing HTTPS redirects
      // which then fail with net::ERR_SSL_PROTOCOL_ERROR (localhost has no valid HTTPS cert)
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Strip any protocol and force http://
        baseUrl = baseUrl.replace(/^https?:\/\//, 'http://');
        if (!baseUrl.startsWith('http://')) {
          baseUrl = 'http://' + window.location.host + baseUrl;
        }
        console.log(`Using HTTP for localhost: ${baseUrl}`);
      } else if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = window.location.protocol + '//' + window.location.host + baseUrl;
      }
      
      // Get CSRF token if not provided
      if (!csrfToken) {
        const tokenElement = document.querySelector('input[name="_csrf"]');
        csrfToken = tokenElement ? tokenElement.value : '';
      }
      
      // Calculate file hash
      this.onProgress({
        status: 'Calculating file hash...',
        uploadedBytes: 0,
        totalBytes: file.size
      });
      const fileHash = await this.calculateFileHash(file);
      console.log('File hash calculated:', fileHash);

      // Initialize upload session
      this.onProgress({
        status: 'Initializing upload session...',
        uploadedBytes: 0,
        totalBytes: file.size
      });

      const initResponse = await fetch(baseUrl + '/init', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'csrf-token': csrfToken || ''
        },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          fileHash: fileHash
        })
      });

      if (!initResponse.ok) {
        const error = await initResponse.json();
        throw new Error(error.message || 'Failed to initialize upload');
      }

      const initData = await initResponse.json();
      this.uploadId = initData.uploadId;
      this.csrfToken = csrfToken; // Store CSRF token for later use
      const totalChunks = Math.ceil(file.size / this.chunkSize);

      console.log(`Upload initialized. ID: ${this.uploadId}, Total chunks: ${totalChunks}`);

      // Get upload progress (check for resumed uploads)
      const progressData = await this.getUploadProgress(baseUrl, csrfToken);
      const uploadedChunkNumbers = progressData.progress && progressData.progress.uploadedChunks 
        ? progressData.progress.uploadedChunks 
        : [];
      const allUploaded = uploadedChunkNumbers.length === totalChunks;
      const startChunk = allUploaded
        ? totalChunks + 1 // Sentinel value beyond range
        : (uploadedChunkNumbers.length > 0 ? Math.max(...uploadedChunkNumbers) + 1 : 1);

      if (allUploaded) {
        console.log('All chunks already uploaded. Finalizing...');
        this.onProgress({
          uploadId: this.uploadId,
          uploadedBytes: file.size,
          totalBytes: file.size,
          status: 'All chunks already uploaded. Finalizing...'
        });
      } else if (startChunk > 1) {
        console.log(`Resuming upload from chunk ${startChunk}`);
        this.onProgress({
          uploadId: this.uploadId,
          uploadedBytes: (startChunk - 1) * this.chunkSize,
          totalBytes: file.size,
          status: `Resuming upload from chunk ${startChunk}...`
        });
      }

      // Only run upload loop if there are remaining chunks
      if (!allUploaded) {
        // Upload chunks
        for (let i = startChunk; i <= totalChunks; i++) {
          const start = (i - 1) * this.chunkSize;
          const end = Math.min(start + this.chunkSize, file.size);
          const chunk = file.slice(start, end);

          await this.uploadChunk(baseUrl, i, chunk, totalChunks, 0, csrfToken);

          // Add delay between chunks if configured
          if (this.chunkDelay > 0 && i < totalChunks) {
            await new Promise(resolve => setTimeout(resolve, this.chunkDelay));
          }

          // Report progress
          this.onProgress({
            uploadId: this.uploadId,
            currentChunk: i,
            totalChunks,
            uploadedBytes: end,
            totalBytes: file.size,
            status: `Uploading chunk ${i} of ${totalChunks}...`
          });

          this.onChunkComplete(i, totalChunks);
        }
      }

      // Complete upload is handled by the caller (app.js)
      this.onProgress({
        status: 'Upload completed! Finalizing...',
        uploadedBytes: file.size,
        totalBytes: file.size
      });
      this.onComplete();
      return { success: true, uploadId: this.uploadId };

    } catch (error) {
      console.error('Upload error:', error);
      this.onError(error);
      throw error;
    }
  }

  /**
   * Upload single chunk with retry
   */
  async uploadChunk(baseUrl, chunkNumber, chunk, totalChunks, retryCount = 0, csrfToken = null) {
    try {
      // On first chunk, verify session is alive
      if (chunkNumber === 1 && retryCount === 0) {
        const sessionOk = await this.checkSessionHealth(csrfToken);
        if (!sessionOk) {
          throw new Error('AUTH_REQUIRED');
        }
      }

      // CRITICAL: Always use HTTP on localhost/127.0.0.1 to avoid HSTS forcing HTTPS redirects
      // which then fail with net::ERR_SSL_PROTOCOL_ERROR (localhost has no valid HTTPS cert)
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Strip any https:// and force http://
        baseUrl = baseUrl.replace(/^https?:\/\//, 'http://');
        if (!baseUrl.startsWith('http://')) {
          baseUrl = 'http://' + window.location.host + baseUrl;
        }
        console.log(`Using HTTP for localhost chunk upload: ${baseUrl}`);
      } else if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = window.location.protocol + '//' + window.location.host + baseUrl;
      }
      
      // Use stored CSRF token if not provided
      if (!csrfToken) {
        csrfToken = this.csrfToken || '';
      }
      
      const formData = new FormData();
      formData.append('chunk', chunk);
      formData.append('chunkNumber', chunkNumber);
      formData.append('totalChunks', totalChunks);
      formData.append('uploadId', this.uploadId);
      
      // Add CSRF token to FormData for multipart/form-data requests
      if (csrfToken) {
        formData.append('_csrf', csrfToken);
      }

      let response;
      let uploadUrl = baseUrl + '/' + this.uploadId + '/chunk';
      
      response = await fetch(uploadUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'csrf-token': csrfToken || ''
        },
        body: formData
      });
      
      // Detect auth failures (401 Unauthorized)
      if (response.status === 401) {
        throw new Error('AUTH_REQUIRED');
      }

      // Detect auth redirect (server protects /api/facilities via isAuthenticated)
      if (response.redirected && response.url.includes('/login')) {
        throw new Error('AUTH_REQUIRED');
      }

      if (!response.ok) {
        throw new Error(`Chunk ${chunkNumber} upload failed: ${response.statusText}`);
      }

      console.log(`Chunk ${chunkNumber}/${totalChunks} uploaded`);
      return await response.json();

    } catch (error) {
      if (error && error.message === 'AUTH_REQUIRED') {
        console.error('Authentication required for chunk upload. Session may have expired or cookies blocked.');
        this.onError(new Error('Authentication lost. Please log in again.'));
        throw error;
      }
      if (retryCount < this.maxRetries) {
        console.log(`Retrying chunk ${chunkNumber} (attempt ${retryCount + 1}/${this.maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.uploadChunk(baseUrl, chunkNumber, chunk, totalChunks, retryCount + 1, csrfToken);
      }
      throw error;
    }
  }

  /**
   * Get upload progress
   */
  async getUploadProgress(baseUrl, csrfToken = null) {
    try {
      // CRITICAL: Always use HTTP on localhost/127.0.0.1 to avoid HSTS forcing HTTPS redirects
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        baseUrl = baseUrl.replace(/^https?:\/\//, 'http://');
        if (!baseUrl.startsWith('http://')) {
          baseUrl = 'http://' + window.location.host + baseUrl;
        }
      } else if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = window.location.protocol + '//' + window.location.host + baseUrl;
      }
      
      // Use stored CSRF token if not provided
      if (!csrfToken) {
        csrfToken = this.csrfToken || '';
      }
      
      const response = await fetch(baseUrl + '/' + this.uploadId + '/progress', {
        credentials: 'same-origin',
        headers: {
          'csrf-token': csrfToken || ''
        }
      });

      if (!response.ok) {
        return { progress: { uploadedChunks: [] } };
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting progress:', error);
      return { progress: { uploadedChunks: [] } };
    }
  }

  /**
   * Cancel upload
   */
  async cancelUpload(baseUrl, csrfToken = null) {
    try {
      // CRITICAL: Always use HTTP on localhost/127.0.0.1 to avoid HSTS forcing HTTPS redirects
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        baseUrl = baseUrl.replace(/^https?:\/\//, 'http://');
        if (!baseUrl.startsWith('http://')) {
          baseUrl = 'http://' + window.location.host + baseUrl;
        }
      } else if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = window.location.protocol + '//' + window.location.host + baseUrl;
      }
      
      // Use stored CSRF token if not provided
      if (!csrfToken) {
        csrfToken = this.csrfToken || '';
      }
      
      const response = await fetch(baseUrl + '/' + this.uploadId + '/cancel', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          'csrf-token': csrfToken || ''
        }
      });

      return await response.json();
    } catch (error) {
      console.error('Error cancelling upload:', error);
      throw error;
    }
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ResumableUploadManager;
} else {
  // Make available globally in browser
  window.ResumableUploadManager = ResumableUploadManager;
}
