#!/usr/bin/env node

/**
 * PostgreSQL Backup Script
 * Automatically backs up the facilities database at scheduled intervals
 * Uses node-cron for scheduling and pg_dump for database backups
 * 
 * Usage: node backup.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const cron = require('node-cron');
require('dotenv').config();
const logger = require('./middleware/logger');

// Configuration
const BACKUP_DIR = path.join(__dirname, 'backups');
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 5432;
const DB_NAME = process.env.DB_NAME || 'facilities_db';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const BACKUP_RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;

// Cron schedule: Every day at 2:00 AM
const BACKUP_SCHEDULE = '0 2 * * *';

// Ensure backups directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  logger.info('Created backups directory', { path: BACKUP_DIR });
}

/**
 * Generate timestamp for backup filename
 * Format: YYYY-MM-DD_HH-MM-SS
 */
function getTimestamp() {
  const now = new Date();
  return now.toISOString()
    .replace(/T/, '_')
    .replace(/\.\d{3}Z/, '')
    .replace(/:/g, '-');
}

/**
 * Perform database backup
 */
async function performBackup() {
  try {
    const timestamp = getTimestamp();
    const backupFileName = `${DB_NAME}_${timestamp}.sql`;
    const backupFilePath = path.join(BACKUP_DIR, backupFileName);

    logger.info('Starting database backup', { 
      database: DB_NAME, 
      filename: backupFileName,
      timestamp
    });

    // Build pg_dump command
    const backupCommand = `pg_dump -h "${DB_HOST}" -p ${DB_PORT} -U "${DB_USER}" -d "${DB_NAME}" --no-password > "${backupFilePath}"`;

    // Set PGPASSWORD environment variable for authentication
    const env = { ...process.env };
    if (DB_PASSWORD) {
      env.PGPASSWORD = DB_PASSWORD;
    }

    // Execute backup with timeout of 5 minutes
    try {
      execSync(backupCommand, {
        env,
        timeout: 5 * 60 * 1000,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (error) {
      // pg_dump might fail but still create a file, so check file size
      if (!fs.existsSync(backupFilePath) || fs.statSync(backupFilePath).size === 0) {
        throw new Error(`pg_dump failed: ${error.message}`);
      }
    }

    // Verify backup file was created and has content
    if (!fs.existsSync(backupFilePath)) {
      throw new Error('Backup file was not created');
    }

    const stats = fs.statSync(backupFilePath);
    if (stats.size === 0) {
      throw new Error('Backup file is empty - database backup failed');
    }

    logger.info('Backup completed successfully', { 
      filename: backupFileName,
      size: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
      location: backupFilePath
    });

    // Cleanup old backups
    cleanupOldBackups();

    return {
      success: true,
      filename: backupFileName,
      path: backupFilePath,
      size: stats.size,
      timestamp
    };

  } catch (error) {
    logger.error('Backup failed', { 
      error: error.message,
      database: DB_NAME
    });

    // Send alert (optional - could integrate with email/Slack)
    sendBackupAlert(false, error.message);

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Cleanup backups older than retention period
 */
function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const now = Date.now();
    let deletedCount = 0;

    files.forEach(file => {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      const ageInDays = (now - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

      if (ageInDays > BACKUP_RETENTION_DAYS) {
        fs.unlinkSync(filePath);
        deletedCount++;
        logger.info('Deleted old backup', { 
          filename: file,
          age: `${ageInDays.toFixed(1)} days`
        });
      }
    });

    if (deletedCount > 0) {
      logger.info('Cleanup completed', { 
        deletedBackups: deletedCount,
        retentionDays: BACKUP_RETENTION_DAYS
      });
    }

  } catch (error) {
    logger.warn('Cleanup old backups failed', { error: error.message });
  }
}

/**
 * Send alert notification (optional)
 * Can be extended to send email, Slack, etc.
 */
function sendBackupAlert(success, message) {
  // TODO: Implement your alert mechanism here
  // Examples: Email, Slack, SMS, etc.
  if (!success) {
    logger.warn('Backup alert', { 
      status: 'FAILED',
      message
    });
  }
}

/**
 * Get backup list for monitoring
 */
function listBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return [];
    }

    const files = fs.readdirSync(BACKUP_DIR);
    return files
      .filter(f => f.endsWith('.sql'))
      .map(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: stats.size,
          sizeInMB: (stats.size / 1024 / 1024).toFixed(2),
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
      .sort((a, b) => b.modified - a.modified);

  } catch (error) {
    logger.error('List backups failed', { error: error.message });
    return [];
  }
}

/**
 * Restore from backup (manual operation)
 */
function restoreBackup(backupFileName) {
  try {
    const backupFilePath = path.join(BACKUP_DIR, backupFileName);

    if (!fs.existsSync(backupFilePath)) {
      throw new Error(`Backup file not found: ${backupFileName}`);
    }

    logger.info('Starting database restore', { 
      database: DB_NAME,
      backup: backupFileName
    });

    const restoreCommand = `psql -h "${DB_HOST}" -p ${DB_PORT} -U "${DB_USER}" -d "${DB_NAME}" < "${backupFilePath}"`;

    const env = { ...process.env };
    if (DB_PASSWORD) {
      env.PGPASSWORD = DB_PASSWORD;
    }

    execSync(restoreCommand, {
      env,
      timeout: 5 * 60 * 1000
    });

    logger.info('Restore completed successfully', { 
      database: DB_NAME,
      backup: backupFileName
    });

    return {
      success: true,
      message: `Successfully restored from ${backupFileName}`
    };

  } catch (error) {
    logger.error('Restore failed', { 
      error: error.message,
      backup: backupFileName
    });

    return {
      success: false,
      error: error.message
    };
  }
}

// Schedule automatic backups
if (process.argv[2] === 'start') {
  logger.info('Starting backup scheduler', { 
    schedule: BACKUP_SCHEDULE,
    database: DB_NAME,
    retention: `${BACKUP_RETENTION_DAYS} days`
  });

  cron.schedule(BACKUP_SCHEDULE, () => {
    logger.info('Scheduled backup triggered');
    performBackup();
  });

  // Keep the process running
  console.log(`✓ Backup scheduler running (${BACKUP_SCHEDULE})`);
  console.log(`  Database: ${DB_NAME} (${DB_HOST}:${DB_PORT})`);
  console.log(`  Backup location: ${BACKUP_DIR}`);
  console.log(`  Retention: ${BACKUP_RETENTION_DAYS} days`);

} else if (process.argv[2] === 'backup') {
  // Manual backup
  performBackup().then(result => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });

} else if (process.argv[2] === 'list') {
  // List backups
  const backups = listBackups();
  console.log(`\nAvailable backups (${backups.length}):\n`);
  backups.forEach((backup, index) => {
    console.log(`  ${index + 1}. ${backup.filename}`);
    console.log(`     Size: ${backup.sizeInMB} MB`);
    console.log(`     Created: ${backup.created.toLocaleString()}`);
  });

} else if (process.argv[2] === 'restore') {
  // Restore backup
  const backupFileName = process.argv[3];
  if (!backupFileName) {
    console.error('Error: Backup filename required');
    console.error('Usage: node backup.js restore <filename>');
    process.exit(1);
  }

  restoreBackup(backupFileName).then(result => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });

} else {
  // Show help
  console.log(`
PostgreSQL Backup Script

Usage:
  node backup.js start              - Start automatic backup scheduler
  node backup.js backup             - Perform manual backup now
  node backup.js list               - List available backups
  node backup.js restore <filename> - Restore from backup

Configuration (via .env):
  DB_HOST              - Database host (default: localhost)
  DB_PORT              - Database port (default: 5432)
  DB_NAME              - Database name (default: facilities_db)
  DB_USER              - Database user (default: postgres)
  DB_PASSWORD          - Database password
  BACKUP_RETENTION_DAYS - Keep backups for N days (default: 30)

Automatic Backup Schedule: ${BACKUP_SCHEDULE} (2:00 AM daily)
Backup Directory: ${BACKUP_DIR}
  `);
}

module.exports = {
  performBackup,
  restoreBackup,
  listBackups,
  cleanupOldBackups,
  getBackupDir: () => BACKUP_DIR
};
