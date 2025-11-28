require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { Pool } = require('pg');
const fs = require('fs');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const csrf = require('csurf');

const config = require('./config/config');
const facilityRoutes = require('./routes/facilities');
const loginRoutes = require('./routes/login');
const userRoutes = require('./routes/users');
const { isAuthenticated } = require('./middleware/authMiddleware');
const { validateAndSanitize } = require('./middleware/validationMiddleware');
const { logger, requestLogger } = require('./middleware/logger');

const app = express();
const PORT = config.port;

// Database pool
const pool = require('./db');

// Initialize database on startup
async function initializeDatabase() {
  const adminPool = new Pool({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: 'postgres', // Connect to default postgres database
  });

  try {
    // Check if database exists
    const dbCheckResult = await adminPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [config.database.name]
    );

    if (dbCheckResult.rows.length === 0) {
      logger.info(`Creating database ${config.database.name}...`);
      await adminPool.query(`CREATE DATABASE ${config.database.name}`);
      logger.info(`Database ${config.database.name} created successfully`);
    }

    await adminPool.end();

    // Connect to the application database
    const appPool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
    });

    // Check if facilities table exists
    const tableCheckResult = await appPool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'facilities'`
    );

    if (tableCheckResult.rows.length === 0) {
      console.log('Creating facilities table...');
      const initScript = fs.readFileSync(path.join(__dirname, 'init-db.sql'), 'utf8');
      // Remove CREATE DATABASE line as we already created it
      const initScriptLines = initScript.split('\n').filter(line => 
        !line.includes('CREATE DATABASE') && !line.includes('\\c facilities_db')
      );
      await appPool.query(initScriptLines.join('\n'));
      console.log('Facilities table created successfully');

      // Seed data
      console.log('Seeding facilities data...');
      const seedScript = fs.readFileSync(path.join(__dirname, 'seed-facilities.sql'), 'utf8');
      await appPool.query(seedScript);
      console.log('Facilities data seeded successfully');
    } else {
      console.log('Facilities table already exists - skipping initialization');
      // Check if facility_list is already seeded
      const facilityListCheck = await appPool.query('SELECT COUNT(*) FROM facility_list');
      const facilityListCount = parseInt(facilityListCheck.rows[0].count);
      if (facilityListCount === 0) {
        console.log('Seeding facilities data...');
        const seedScript = fs.readFileSync(path.join(__dirname, 'seed-facilities.sql'), 'utf8');
        await appPool.query(seedScript);
        console.log('Facilities data seeded successfully');
      } else {
        console.log('Facilities already seeded - skipping seed');
      }
    }

    // Check if users table exists and create if needed
    const usersTableCheckResult = await appPool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'users'`
    );

    if (usersTableCheckResult.rows.length === 0) {
      console.log('Creating users table...');
      await appPool.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(100) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          email VARCHAR(100),
          role VARCHAR(20) DEFAULT 'uploader' CHECK (role IN ('admin', 'uploader')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX idx_username ON users(username);
      `);
      console.log('Users table created successfully');
    } else {
      // Check if role column exists and add it if not
      try {
        await appPool.query('SELECT role FROM users LIMIT 1');
      } catch (err) {
        if (err.message.includes('column "role" does not exist')) {
          console.log('Adding role column to users table...');
          await appPool.query(`
            ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'uploader' CHECK (role IN ('admin', 'uploader'))
          `);
        }
      }
    }

    // Check if users are seeded
    const userCheck = await appPool.query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(userCheck.rows[0].count);
    if (userCount === 0) {
      console.log('Seeding admin user...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await appPool.query(
        `INSERT INTO users (username, password, email, role, created_at) VALUES ($1, $2, $3, $4, NOW())`,
        ['admin', hashedPassword, 'admin@facilities.local', 'admin']
      );
      console.log('Admin user created successfully with username: admin, password: admin123');
      console.log('Use the admin account to log in and create additional users via User Management');
    }

    await appPool.end();
  } catch (error) {
    console.error('Database initialization error:', error);
    process.exit(1);
  }
}

// Initialize database before starting the server
initializeDatabase();

// Passport LocalStrategy
passport.use(new LocalStrategy(async (username, password, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      logger.warn(`Failed login attempt: username not found - ${username}`);
      return done(null, false, { message: 'Incorrect username.' });
    }
    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (passwordMatch) {
      logger.info(`User logged in successfully - ${username}`);
      return done(null, user);
    } else {
      logger.warn(`Failed login attempt: incorrect password - ${username}`);
      return done(null, false, { message: 'Incorrect password.' });
    }
  } catch (error) {
    logger.error('Authentication error', error);
    return done(error);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0]);
  } catch (error) {
    done(error);
  }
});

// Security Middleware - Must be before routes
// Helmet configuration - disable HSTS on localhost for development
app.use(helmet({
  hsts: {
    maxAge: 0, // Disable HSTS completely for development/HTTP
    includeSubDomains: false,
    preload: false
  },
  // Disable COOP/COEP headers for HTTP (only safe on HTTPS)
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
  // Allow form submissions
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      formAction: ["'self'", "http:", "https:"],
      connectSrc: ["'self'", "http:", "https:"]
    }
  },
  // Allow framing from same origin
  frameguard: { action: 'SAMEORIGIN' }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimiting.windowMs,
  max: config.rateLimiting.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Skip chunk uploads from rate limiting
  skip: (req) => req.path.match(/\/api\/facilities\/resumable\/[^/]+\/chunk/)
});
app.use(limiter);

// Lenient rate limiting for chunk uploads (allow bulk uploads)
const chunkUploadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 500, // 500 chunk uploads per minute per IP
  message: 'Too many chunk uploads, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !req.path.match(/\/api\/facilities\/resumable\/[^/]+\/chunk/)
});
app.use(chunkUploadLimiter);

// Stricter rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 minutes
  skipSuccessfulRequests: true,
});

// Input validation and sanitization
app.use(validateAndSanitize);

// Sanitize MongoDB query injections
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.warn(`Potentially malicious input detected in ${key}`);
  }
}));

// Request logging
app.use(requestLogger);

// Middleware
app.use(bodyParser.json({ limit: '2gb' }));
app.use(bodyParser.urlencoded({ limit: '2gb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration with secure settings
app.use(session({
  secret: config.security.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.nodeEnv === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    sameSite: 'lax'  // Changed from 'strict' to 'lax' to allow cookies on same-origin redirects
  }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// CSRF protection - DISABLED
// const csrfProtection = csrf({ cookie: false });
// app.use((req, res, next) => {
//   // Skip CSRF for resumable upload routes - /init, /chunk, /complete, /cancel
//   if (req.path.match(/\/api\/facilities\/resumable\//)) {
//     return next();
//   }
//   csrfProtection(req, res, next);
// });

// Pass CSRF token to views (only when CSRF is available)
app.use((req, res, next) => {
  res.locals.csrfToken = null;
  next();
});

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Apply stricter rate limiting to auth routes
app.use('/login', authLimiter);
app.post('/login', authLimiter);

// Routes
app.use(loginRoutes);

app.use('/api/facilities', isAuthenticated, facilityRoutes);
app.use('/api/users', isAuthenticated, userRoutes);

// Home route
app.get('/', isAuthenticated, (req, res) => {
  res.render('index', { user: req.user });
});

// User management route (admin only)
app.get('/users', isAuthenticated, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).render('error', { 
      message: 'Admin access required',
      user: req.user 
    });
  }
  res.render('users', { user: req.user });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404 handler
app.use((req, res) => {
  logger.warn(`404 Not Found - ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware (must be last)
app.use((err, req, res, next) => {
  logger.error('Unexpected error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // CSRF error handling
  if (err.code === 'EBADCSRFTOKEN') {
    logger.warn(`CSRF token validation failed - ${req.path}`);
    return res.status(403).json({
      success: false,
      message: 'Invalid CSRF token'
    });
  }

  // Generic error response
  res.status(err.status || 500).json({
    success: false,
    message: config.nodeEnv === 'production' 
      ? 'Internal server error' 
      : err.message || 'Internal server error'
  });
});

const server = app.listen(PORT, () => {
  logger.info(`Server running in ${config.nodeEnv} mode on port ${PORT}`);
  logger.info(`Database: ${config.database.name} at ${config.database.host}:${config.database.port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection', err);
  process.exit(1);
});
