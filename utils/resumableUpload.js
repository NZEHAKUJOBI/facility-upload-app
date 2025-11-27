const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ResumableUploadManager {
  constructor(uploadsDir = './uploads') {
    this.uploadsDir = uploadsDir;
    this.chunksDir = path.join(uploadsDir, 'chunks');
    
    // Create directories if they don't exist
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
    if (!fs.existsSync(this.chunksDir)) {
      fs.mkdirSync(this.chunksDir, { recursive: true });
    }
  }

  /**
   * Generate unique upload ID based on file hash and metadata
   */
  generateUploadId(filename, fileSize, fileHash) {
    const data = `${filename}-${fileSize}-${fileHash}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Get chunk file path
   */
  getChunkPath(uploadId, chunkNumber) {
    return path.join(this.chunksDir, `${uploadId}-chunk-${chunkNumber}`);
  }

  /**
   * Get upload metadata file path
   */
  getMetadataPath(uploadId) {
    return path.join(this.chunksDir, `${uploadId}-metadata.json`);
  }

  /**
   * Initialize upload session
   */
  initializeUpload(uploadId, metadata) {
    const metadataPath = this.getMetadataPath(uploadId);
    
    const uploadMetadata = {
      uploadId,
      filename: metadata.filename,
      fileSize: metadata.fileSize,
      fileHash: metadata.fileHash,
      chunkSize: metadata.chunkSize || 5242880, // 5MB default
      totalChunks: Math.ceil(metadata.fileSize / (metadata.chunkSize || 5242880)),
      uploadedChunks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'in_progress'
    };

    fs.writeFileSync(metadataPath, JSON.stringify(uploadMetadata, null, 2));
    return uploadMetadata;
  }

  /**
   * Get upload progress
   */
  getUploadProgress(uploadId) {
    const metadataPath = this.getMetadataPath(uploadId);
    
    if (!fs.existsSync(metadataPath)) {
      return null;
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const uploadedChunks = [];

    // Check which chunks exist
    for (let i = 1; i <= metadata.totalChunks; i++) {
      const chunkPath = this.getChunkPath(uploadId, i);
      if (fs.existsSync(chunkPath)) {
        uploadedChunks.push(i);
      }
    }

    metadata.uploadedChunks = uploadedChunks;
    metadata.uploadedSize = uploadedChunks.length * metadata.chunkSize;
    metadata.progress = Math.round((uploadedChunks.length / metadata.totalChunks) * 100);
    metadata.updatedAt = new Date();

    // Update metadata
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    return metadata;
  }

  /**
   * Save uploaded chunk
   */
  saveChunk(uploadId, chunkNumber, chunkData) {
    const chunkPath = this.getChunkPath(uploadId, chunkNumber);
    fs.writeFileSync(chunkPath, chunkData);
    return { chunkNumber, saved: true };
  }

  /**
   * Assemble chunks into final file
   */
  assembleChunks(uploadId, outputPath) {
    const metadataPath = this.getMetadataPath(uploadId);
    
    if (!fs.existsSync(metadataPath)) {
      throw new Error('Upload metadata not found');
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const writeStream = fs.createWriteStream(outputPath);

    return new Promise((resolve, reject) => {
      let chunkIndex = 1;

      const writeNextChunk = () => {
        if (chunkIndex > metadata.totalChunks) {
          writeStream.end();
          return;
        }

        const chunkPath = this.getChunkPath(uploadId, chunkIndex);
        
        if (!fs.existsSync(chunkPath)) {
          reject(new Error(`Chunk ${chunkIndex} not found`));
          return;
        }

        const readStream = fs.createReadStream(chunkPath);
        readStream.on('end', () => {
          chunkIndex++;
          writeNextChunk();
        });
        readStream.on('error', reject);
        readStream.pipe(writeStream, { end: false });
      };

      writeStream.on('finish', () => {
        // Clean up chunks after successful assembly
        this.cleanupChunks(uploadId);
        resolve(outputPath);
      });
      writeStream.on('error', reject);

      writeNextChunk();
    });
  }

  /**
   * Clean up chunks after assembly
   */
  cleanupChunks(uploadId) {
    const metadataPath = this.getMetadataPath(uploadId);
    
    if (!fs.existsSync(metadataPath)) {
      return;
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

    // Delete chunk files
    for (let i = 1; i <= metadata.totalChunks; i++) {
      const chunkPath = this.getChunkPath(uploadId, i);
      if (fs.existsSync(chunkPath)) {
        fs.unlinkSync(chunkPath);
      }
    }

    // Delete metadata
    if (fs.existsSync(metadataPath)) {
      fs.unlinkSync(metadataPath);
    }
  }

  /**
   * Cancel upload and cleanup
   */
  cancelUpload(uploadId) {
    this.cleanupChunks(uploadId);
    return { uploadId, cancelled: true };
  }

  /**
   * Clean old uploads (older than 24 hours)
   */
  cleanupOldUploads(maxAgeHours = 24) {
    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000;

    fs.readdirSync(this.chunksDir).forEach(file => {
      if (file.endsWith('-metadata.json')) {
        const filepath = path.join(this.chunksDir, file);
        const stats = fs.statSync(filepath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          const uploadId = file.replace('-metadata.json', '');
          this.cleanupChunks(uploadId);
        }
      }
    });
  }
}

module.exports = ResumableUploadManager;
