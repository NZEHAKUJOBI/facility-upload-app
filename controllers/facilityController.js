const pool = require('../db');
const fs = require('fs');
const path = require('path');
const pgdumpUtils = require('../utils/pgdumpUtils');
const { sanitizeInput, validateFacilityCode } = require('../middleware/validationMiddleware');
const ResumableUploadManager = require('../utils/resumableUpload');
const MAX_FACILITIES = parseInt(process.env.MAX_FACILITIES) || 11;

// Initialize resumable upload session
exports.initializeResumableUpload = async (req, res) => {
  try {
    const { fileName, fileSize, fileHash } = req.body;

    // Validate inputs
    if (!fileName || !fileSize || !fileHash) {
      return res.status(400).json({
        success: false,
        message: 'fileName, fileSize, and fileHash are required'
      });
    }

    // Generate upload ID and initialize session
    const uploadManager = new ResumableUploadManager();
    const uploadId = uploadManager.generateUploadId(fileName, fileSize, fileHash);
    
    try {
      uploadManager.initializeUpload(uploadId, {
        fileName: sanitizeInput(fileName),
        fileSize: parseInt(fileSize),
        fileHash,
        userId: req.user.id,
        uploadedAt: new Date().toISOString()
      });

      res.status(200).json({
        success: true,
        uploadId,
        chunkSize: 5 * 1024 * 1024 // 5MB chunks
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  } catch (error) {
    console.error('Initialize resumable upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get upload progress
exports.getResumableUploadProgress = async (req, res) => {
  try {
    const { uploadId } = req.params;

    if (!uploadId) {
      return res.status(400).json({
        success: false,
        message: 'uploadId is required'
      });
    }

    const uploadManager = new ResumableUploadManager();
    const progress = uploadManager.getUploadProgress(uploadId);

    res.status(200).json({
      success: true,
      progress
    });
  } catch (error) {
    console.error('Get upload progress error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Upload a chunk
exports.uploadChunk = async (req, res) => {
  try {
    const { uploadId, chunkNumber, totalChunks } = req.body;
    const chunk = req.file;

    // Validate inputs
    if (!uploadId || chunkNumber === undefined || !chunk) {
      if (chunk) fs.unlinkSync(chunk.path);
      return res.status(400).json({
        success: false,
        message: 'uploadId, chunkNumber, and chunk file are required'
      });
    }

    const uploadManager = new ResumableUploadManager();
    
    try {
      // Read chunk data from uploaded file
      const chunkData = fs.readFileSync(chunk.path);
      
      // Save chunk
      uploadManager.saveChunk(uploadId, parseInt(chunkNumber), chunkData);
      
      // Clean up temporary file
      fs.unlinkSync(chunk.path);

      // Get current progress
      const progress = uploadManager.getUploadProgress(uploadId);

      res.status(200).json({
        success: true,
        chunkNumber: parseInt(chunkNumber),
        uploadedChunks: progress.uploadedChunks,
        totalChunks: progress.totalChunks
      });
    } catch (error) {
      if (chunk && fs.existsSync(chunk.path)) {
        fs.unlinkSync(chunk.path);
      }
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  } catch (error) {
    console.error('Upload chunk error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Complete resumable upload and assemble chunks
exports.completeResumableUpload = async (req, res) => {
  try {
    const { uploadId, facilityName, facilityCode, description } = req.body;

    // Validate inputs
    if (!uploadId || !facilityName || !facilityCode) {
      return res.status(400).json({
        success: false,
        message: 'uploadId, facilityName, and facilityCode are required'
      });
    }

    // Sanitize inputs
    const sanitizedName = sanitizeInput(facilityName);
    const sanitizedCode = sanitizeInput(facilityCode);
    const sanitizedDesc = description ? sanitizeInput(description) : null;

    // Validate facility code
    const codeValidation = validateFacilityCode(sanitizedCode);
    if (!codeValidation.valid) {
      return res.status(400).json({
        success: false,
        message: codeValidation.error
      });
    }

    const uploadManager = new ResumableUploadManager();
    
    try {
      // Get upload progress to verify all chunks are uploaded
      const progress = uploadManager.getUploadProgress(uploadId);
      
      if (!progress) {
        return res.status(404).json({
          success: false,
          message: 'Upload session not found'
        });
      }

      // Check if all chunks are uploaded (uploadedChunks is an array)
      if (progress.uploadedChunks.length !== progress.totalChunks) {
        return res.status(400).json({
          success: false,
          message: `Upload incomplete. ${progress.uploadedChunks.length}/${progress.totalChunks} chunks uploaded`
        });
      }

      // Assemble chunks into final file
      const finalFileName = sanitizedCode + '_' + Date.now() + '.sql';
      const uploadsDir = path.join(__dirname, '..', 'uploads');
      const finalFilePath = path.join(uploadsDir, finalFileName);
      
      await uploadManager.assembleChunks(uploadId, finalFilePath);

      // Verify file was created
      if (!fs.existsSync(finalFilePath)) {
        return res.status(500).json({
          success: false,
          message: 'Failed to assemble uploaded file'
        });
      }

      // Store facility record in database
      const result = await pool.query(
        `INSERT INTO facilities (facility_name, facility_code, description, file_path, uploaded_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id, facility_name, facility_code, uploaded_at`,
        [sanitizedName, sanitizedCode, sanitizedDesc, finalFilePath]
      );

      // Check facility count limit
      const countResult = await pool.query('SELECT COUNT(*) as count FROM facilities');
      if (countResult.rows[0].count > MAX_FACILITIES) {
        // Delete oldest facility if over limit
        const oldestResult = await pool.query(
          'SELECT id, file_path FROM facilities ORDER BY uploaded_at ASC LIMIT 1'
        );
        if (oldestResult.rows[0]) {
          const oldFacility = oldestResult.rows[0];
          if (fs.existsSync(oldFacility.file_path)) {
            fs.unlinkSync(oldFacility.file_path);
          }
          await pool.query('DELETE FROM facilities WHERE id = $1', [oldFacility.id]);
        }
      }

      // Clean up upload session
      uploadManager.cleanupChunks(uploadId);

      res.status(200).json({
        success: true,
        message: 'Upload completed successfully',
        facility: result.rows[0]
      });
    } catch (error) {
      console.error('Error in resumable upload completion:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  } catch (error) {
    console.error('Complete resumable upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Cancel resumable upload
exports.cancelResumableUpload = async (req, res) => {
  try {
    const { uploadId } = req.params;

    if (!uploadId) {
      return res.status(400).json({
        success: false,
        message: 'uploadId is required'
      });
    }

    const uploadManager = new ResumableUploadManager();
    
    try {
      uploadManager.cancelUpload(uploadId);
      
      res.status(200).json({
        success: true,
        message: 'Upload cancelled successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  } catch (error) {
    console.error('Cancel resumable upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get facility list for dropdown
exports.getFacilityList = async (req, res) => {
  try {
    const result = await pool.query('SELECT id, facility_name, facility_code FROM facility_list ORDER BY facility_name');
    res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get facility list error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Upload database for a facility
exports.uploadDatabase = async (req, res) => {
  try {
    let { facility_name, facility_code, description } = req.body;
    const file = req.file;

    // Sanitize inputs
    facility_name = sanitizeInput(facility_name);
    facility_code = sanitizeInput(facility_code);
    description = description ? sanitizeInput(description) : null;

    // Validate required fields
    if (!facility_name || !facility_code) {
      if (file) fs.unlinkSync(file.path);
      return res.status(400).json({
        success: false,
        message: 'facility_name and facility_code are required'
      });
    }

    // Validate facility code format
    const codeValidation = validateFacilityCode(facility_code);
    if (!codeValidation.valid) {
      if (file) fs.unlinkSync(file.path);
      return res.status(400).json({
        success: false,
        message: codeValidation.error
      });
    }

    // Check if facility already has an upload
    const existingResult = await pool.query(
      'SELECT * FROM facilities WHERE facility_code = $1',
      [facility_code]
    );

    if (existingResult.rows.length > 0) {
      const existingFacility = existingResult.rows[0];
      // Delete the old file
      if (existingFacility.file_path && fs.existsSync(existingFacility.file_path)) {
        fs.unlinkSync(existingFacility.file_path);
      }
      // Delete the old record
      await pool.query('DELETE FROM facilities WHERE facility_code = $1', [facility_code]);
    }

    // Check if we've reached the max facilities limit (only check if new facility)
    if (existingResult.rows.length === 0) {
      const countResult = await pool.query('SELECT COUNT(*) FROM facilities');
      const facilitiesCount = parseInt(countResult.rows[0].count);

      if (facilitiesCount >= MAX_FACILITIES) {
        if (file) fs.unlinkSync(file.path);
        return res.status(400).json({
          success: false,
          message: `Maximum facilities limit (${MAX_FACILITIES}) reached`
        });
      }
    }

    // Insert facility into database
    const result = await pool.query(
      `INSERT INTO facilities (facility_name, facility_code, description, file_path, uploaded_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [facility_name, facility_code, description || null, file ? file.path : null]
    );

    res.status(201).json({
      success: true,
      message: existingResult.rows.length > 0 ? 'Facility updated successfully' : 'Facility uploaded successfully',
      data: result.rows[0]
    });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// List all facilities
exports.listFacilities = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM facilities ORDER BY uploaded_at DESC');
    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('List error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get facility by ID
exports.getFacilityById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM facilities WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Facility not found'
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update facility
exports.updateFacility = async (req, res) => {
  try {
    const { id } = req.params;
    let { facility_name, facility_code, description } = req.body;

    // Sanitize inputs
    facility_name = facility_name ? sanitizeInput(facility_name) : null;
    facility_code = facility_code ? sanitizeInput(facility_code) : null;
    description = description ? sanitizeInput(description) : null;

    // Validate facility code if provided
    if (facility_code) {
      const codeValidation = validateFacilityCode(facility_code);
      if (!codeValidation.valid) {
        return res.status(400).json({
          success: false,
          message: codeValidation.error
        });
      }
    }

    const result = await pool.query(
      `UPDATE facilities
       SET facility_name = COALESCE($1, facility_name),
           facility_code = COALESCE($2, facility_code),
           description = COALESCE($3, description),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [facility_name, facility_code, description, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Facility not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Facility updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete facility
exports.deleteFacility = async (req, res) => {
  try {
    const { id } = req.params;

    // Get the facility to find the file path
    const facilityResult = await pool.query('SELECT * FROM facilities WHERE id = $1', [id]);

    if (facilityResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Facility not found'
      });
    }

    // Delete file if it exists
    const filePath = facilityResult.rows[0].file_path;
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await pool.query('DELETE FROM facilities WHERE id = $1', [id]);

    res.status(200).json({
      success: true,
      message: 'Facility deleted successfully'
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Restore PostgreSQL dump file
exports.restoreDump = async (req, res) => {
  try {
    const { id } = req.params;

    // Get the facility and its file path
    const facilityResult = await pool.query('SELECT * FROM facilities WHERE id = $1', [id]);

    if (facilityResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Facility not found'
      });
    }

    const facility = facilityResult.rows[0];
    const filePath = facility.file_path;

    // Check if file exists
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(400).json({
        success: false,
        message: 'Database file not found'
      });
    }

    // Validate it's a pgdump file
    const isValid = await pgdumpUtils.validatePgDumpFile(filePath);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'File is not a valid PostgreSQL dump file'
      });
    }

    // Get metadata
    const metadata = await pgdumpUtils.getPgDumpMetadata(filePath);

    // Restore the dump (optional - only if explicitly requested)
    // This requires psql to be installed on the server
    // For now, we'll just validate and return metadata
    res.status(200).json({
      success: true,
      message: 'Database dump file validated successfully',
      data: {
        facility: facility,
        metadata: metadata,
        fileSize: pgdumpUtils.getFileSizeReadable(fs.statSync(filePath).size)
      }
    });
  } catch (error) {
    console.error('Restore dump error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Download database file
exports.downloadDatabase = async (req, res) => {
  try {
    const { id } = req.params;

    // Get the facility and its file path
    const facilityResult = await pool.query('SELECT * FROM facilities WHERE id = $1', [id]);

    if (facilityResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Facility not found'
      });
    }

    const facility = facilityResult.rows[0];
    const filePath = facility.file_path;

    // Check if file exists
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(400).json({
        success: false,
        message: 'Database file not found'
      });
    }

    // Download the file
    res.download(filePath, `${facility.facility_code}-dump.sql`, (err) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Error downloading file'
          });
        }
      }
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Generate and download upload report
exports.downloadReport = async (req, res) => {
  try {
    // Get all facilities
    const result = await pool.query(
      `SELECT facility_name, facility_code, description, uploaded_at, file_path 
       FROM facilities 
       ORDER BY uploaded_at DESC`
    );

    // Generate CSV report
    let csv = 'Facility Name,Facility Code,Description,Uploaded Date,File Path\n';
    
    result.rows.forEach(facility => {
      const description = facility.description ? facility.description.replace(/,/g, ';') : '';
      const fileName = facility.file_path ? facility.file_path.split(/[\\/]/).pop() : 'N/A';
      const uploadedDate = facility.uploaded_at ? new Date(facility.uploaded_at).toLocaleString() : 'N/A';
      
      csv += `"${facility.facility_name}","${facility.facility_code}","${description}","${uploadedDate}","${fileName}"\n`;
    });

    // Send as file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="upload-report-${new Date().getTime()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Report download error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

