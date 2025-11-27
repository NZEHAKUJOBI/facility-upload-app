const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logLevels = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

const getTimestamp = () => {
  return new Date().toISOString();
};

const logToFile = (level, message, data = null) => {
  const logFile = path.join(logsDir, `${level.toLowerCase()}.log`);
  const logEntry = {
    timestamp: getTimestamp(),
    level,
    message,
    ...(data && { data })
  };

  const logLine = JSON.stringify(logEntry) + '\n';

  fs.appendFileSync(logFile, logLine, (err) => {
    if (err) console.error('Failed to write to log file:', err);
  });

  // Also log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[${level}] ${message}`, data || '');
  }
};

const logger = {
  error: (message, data) => logToFile(logLevels.ERROR, message, data),
  warn: (message, data) => logToFile(logLevels.WARN, message, data),
  info: (message, data) => logToFile(logLevels.INFO, message, data),
  debug: (message, data) => logToFile(logLevels.DEBUG, message, data)
};

/**
 * Express middleware for request logging
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: req.user?.id || 'anonymous'
    };

    if (res.statusCode >= 400) {
      logger.warn(`HTTP ${res.statusCode}`, logData);
    } else {
      logger.info(`HTTP ${res.statusCode}`, logData);
    }
  });

  next();
};

module.exports = {
  logger,
  requestLogger,
  logLevels
};
