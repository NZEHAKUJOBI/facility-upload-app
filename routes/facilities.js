const express = require('express');
const multer = require('multer');
const path = require('path');
const facilityController = require('../controllers/facilityController');
const { isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024 // 2GB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only PostgreSQL dump/backup file types
    const allowedMimes = [
      'application/octet-stream',
      'application/x-sql',
      'text/plain',
      'application/sql'
    ];
    
    // Check file extension
    const allowedExtensions = ['.dump', '.sql', '.bak', '.backup'];
    const fileExt = require('path').extname(file.originalname).toLowerCase();
    
    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PostgreSQL dump files allowed (DUMP, SQL, BAK, BACKUP)'));
    }
  }
});

// Configure multer for chunk uploads (small pieces)
const chunkStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `chunk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  }
});

const uploadChunk = multer({
  storage: chunkStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB per chunk
  }
});

// Resumable upload routes (must be before generic /:id routes)
router.post('/resumable/init', facilityController.initializeResumableUpload);
router.get('/resumable/:uploadId/progress', facilityController.getResumableUploadProgress);
router.post('/resumable/:uploadId/chunk', uploadChunk.single('chunk'), facilityController.uploadChunk);
router.post('/resumable/:uploadId/complete', facilityController.completeResumableUpload);
router.delete('/resumable/:uploadId/cancel', facilityController.cancelResumableUpload);

// Traditional upload routes
router.post('/upload', upload.single('file'), facilityController.uploadDatabase);
router.post('/:id/restore-dump', isAdmin, facilityController.restoreDump);
router.get('/list', facilityController.listFacilities);
router.get('/facility-list', facilityController.getFacilityList);
router.get('/download/:id', isAdmin, facilityController.downloadDatabase);
router.get('/report/download', isAdmin, facilityController.downloadReport);
router.get('/:id', facilityController.getFacilityById);
router.put('/:id', facilityController.updateFacility);
router.delete('/:id', isAdmin, facilityController.deleteFacility);

module.exports = router;
