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
const facilityRoutes = require('./routes/facilities');

const app = express();
const PORT = process.env.PORT || 3000;

// Database pool
const pool = require('./db');

// Initialize database on startup
async function initializeDatabase() {
  const adminPool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres', // Connect to default postgres database
  });

  try {
    // Check if database exists
    const dbCheckResult = await adminPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [process.env.DB_NAME]
    );

    if (dbCheckResult.rows.length === 0) {
      console.log(`Creating database ${process.env.DB_NAME}...`);
      await adminPool.query(`CREATE DATABASE ${process.env.DB_NAME}`);
      console.log(`Database ${process.env.DB_NAME} created successfully`);
    }

    await adminPool.end();

    // Connect to the application database
    const appPool = new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
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
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX idx_username ON users(username);
      `);
      console.log('Users table created successfully');
    }

    // Check if users are seeded
    const userCheck = await appPool.query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(userCheck.rows[0].count);
    if (userCount === 0) {
      console.log('Seeding users data...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await appPool.query(
        `INSERT INTO users (username, password, email, created_at) VALUES ($1, $2, $3, NOW())`,
        ['admin', hashedPassword, 'admin@facilities.local']
      );
      console.log('Users data seeded successfully with username: admin, password: admin123');
    }

    await appPool.end();
  } catch (error) {
    console.error('Database initialization error:', error);
    process.exit(1);
  }
}

// Initialize database before starting the server
initializeDatabase();

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Passport LocalStrategy
passport.use(new LocalStrategy(async (username, password, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return done(null, false, { message: 'Incorrect username.' });
    }
    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (passwordMatch) {
      return done(null, user);
    } else {
      return done(null, false, { message: 'Incorrect password.' });
    }
  } catch (error) {
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

// Middleware
app.use(bodyParser.json({ limit: '2gb' }));
app.use(bodyParser.urlencoded({ limit: '2gb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    next();
  } else {
    res.redirect('/login');
  }
};

// Routes
app.get('/login', (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect('/');
  } else {
    res.render('login');
  }
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login'
}));

app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.redirect('/login');
  });
});

app.use('/api/facilities', isAuthenticated, facilityRoutes);

// Home route
app.get('/', isAuthenticated, (req, res) => {
  res.render('index', { user: req.user });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
