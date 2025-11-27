const pool = require('../db');
const fs = require('fs');
const path = require('path');
const pgdumpUtils = require('../utils/pgdumpUtils');
const { sanitizeInput, validateFacilityCode } = require('../middleware/validationMiddleware');
const MAX_FACILITIES = parseInt(process.env.MAX_FACILITIES) || 11;

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

