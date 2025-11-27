const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execPromise = promisify(exec);

/**
 * Validate if a file is a valid PostgreSQL dump file
 */
exports.validatePgDumpFile = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      // Check for PostgreSQL dump file signatures
      const isPgDump = data.includes('PostgreSQL database dump') || 
                       data.includes('-- PostgreSQL') ||
                       data.includes('SET statement_timeout') ||
                       data.includes('CREATE TABLE') ||
                       data.includes('INSERT INTO');

      resolve(isPgDump);
    });
  });
};

/**
 * Get PostgreSQL dump file metadata
 */
exports.getPgDumpMetadata = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      const lines = data.split('\n');
      const metadata = {
        isValid: false,
        version: null,
        dumpDate: null,
        tables: []
      };

      // Extract metadata from dump file
      lines.forEach(line => {
        if (line.includes('PostgreSQL database dump')) {
          metadata.isValid = true;
        }
        if (line.includes('Dumped from database version')) {
          metadata.version = line.split('version')[1]?.trim();
        }
        if (line.includes('Dumped on')) {
          metadata.dumpDate = line.split('Dumped on')[1]?.trim();
        }
        if (line.startsWith('CREATE TABLE')) {
          const tableName = line.match(/CREATE TABLE (?:IF NOT EXISTS )?"?([^"\s(]+)/)?.[1];
          if (tableName) {
            metadata.tables.push(tableName);
          }
        }
      });

      resolve(metadata);
    });
  });
};

/**
 * Restore PostgreSQL dump to a specific database
 * Note: Requires psql to be installed and in PATH
 */
exports.restorePgDump = (filePath, dbName, dbHost, dbPort, dbUser, dbPassword) => {
  return new Promise((resolve, reject) => {
    // Create PGPASSWORD environment variable to avoid password prompt
    const env = { ...process.env };
    if (dbPassword) {
      env.PGPASSWORD = dbPassword;
    }

    // psql command to restore the dump
    const cmd = `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -f "${filePath}"`;

    exec(cmd, { env }, (error, stdout, stderr) => {
      if (error) {
        reject({
          message: 'Failed to restore database dump',
          error: error.message,
          stderr: stderr
        });
        return;
      }

      resolve({
        success: true,
        message: 'Database dump restored successfully',
        output: stdout
      });
    });
  });
};

/**
 * Get file size in human-readable format
 */
exports.getFileSizeReadable = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};
