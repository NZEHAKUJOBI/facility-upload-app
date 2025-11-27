require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'facilities_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  },

  security: {
    sessionSecret: process.env.SESSION_SECRET || 'change-this-in-production-min-32-chars',
    jwtSecret: process.env.JWT_SECRET || 'change-this-in-production-min-32-chars',
    allowInsecureHttp: process.env.ALLOW_INSECURE_HTTP === 'true',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000'
  },

  rateLimiting: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
  },

  application: {
    maxFacilities: parseInt(process.env.MAX_FACILITIES || '11'),
    uploadFolder: process.env.UPLOAD_FOLDER || './uploads',
    logLevel: process.env.LOG_LEVEL || 'info'
  }
};

// Validate required environment variables
const validateConfig = () => {
  const errors = [];

  if (!config.database.password && config.nodeEnv === 'production') {
    errors.push('DB_PASSWORD is required in production');
  }

  if (config.security.sessionSecret.includes('change-this') && config.nodeEnv === 'production') {
    errors.push('SESSION_SECRET must be changed in production');
  }

  if (config.security.jwtSecret.includes('change-this') && config.nodeEnv === 'production') {
    errors.push('JWT_SECRET must be changed in production');
  }

  if (errors.length > 0) {
    console.error('Configuration errors:', errors);
    if (config.nodeEnv === 'production') {
      process.exit(1);
    }
  }
};

// Validate on load
validateConfig();

module.exports = config;
