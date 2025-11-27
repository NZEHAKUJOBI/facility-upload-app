# Facility Database Upload App - Production Ready

A secure, role-based Express.js application for managing PostgreSQL database uploads for multiple facilities with admin and uploader roles.

## Features

### Core Features
- ✅ User authentication with role-based access control (Admin/Uploader)
- ✅ Upload PostgreSQL database dumps (up to 2GB)
- ✅ Admin user management (create, update, delete users)
- ✅ Download database files (admin only)
- ✅ Download upload reports as CSV (admin only)
- ✅ View database metadata (tables, version, dump date)
- ✅ Facility management with metadata storage
- ✅ Progress tracking for uploads and downloads
- ✅ Responsive web interface

### Security Features
- ✅ CSRF protection with csurf middleware
- ✅ Security headers with Helmet.js
- ✅ Rate limiting on all routes & stricter limits on auth routes
- ✅ Input sanitization with XSS protection
- ✅ SQL injection prevention (parameterized queries)
- ✅ Password hashing with bcrypt
- ✅ Secure session management (HTTPOnly, SameSite cookies)
- ✅ Request logging with Winston
- ✅ Environment-based configuration
- ✅ Error handling with logging
- ✅ Health check endpoint

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm

## Installation

### 1. Clone and Navigate to Project

```bash
cd facility-upload-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy `.env.example` to `.env` and update with your configuration:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=facilities_db
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Security (IMPORTANT: Change these in production)
SESSION_SECRET=your_secure_session_secret_min_32_chars
JWT_SECRET=your_secure_jwt_secret_min_32_chars

# Application Settings
MAX_FACILITIES=11
UPLOAD_FOLDER=./uploads
LOG_LEVEL=info
```

**⚠️ SECURITY WARNING**: In production, ensure:
- `SESSION_SECRET` is a random string of at least 32 characters
- `JWT_SECRET` is a random string of at least 32 characters
- `NODE_ENV=production`
- `DB_PASSWORD` is a strong password
- Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)

### 4. Initialize Database

```bash
# PostgreSQL will auto-initialize on first run
# Or manually run:
psql -U postgres -f init-db.sql
```

## Running the Application

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The application will be available at `http://localhost:3000`

### Health Check

```bash
curl http://localhost:3000/health
```

## Default Credentials

**Initial Admin User:**
- Username: `admin`
- Password: `admin123`

⚠️ **IMPORTANT**: Change this password immediately after first login!

## User Roles

### Admin Role
- ✅ View all facilities
- ✅ Upload facility databases
- ✅ Download facility database files
- ✅ View database metadata and tables
- ✅ Delete facilities
- ✅ Download upload reports (CSV)
- ✅ Manage users (create, update, delete, reset passwords)
- ✅ Access admin dashboard

### Uploader Role
- ✅ View all facilities
- ✅ Upload facility databases only
- ❌ Cannot download files
- ❌ Cannot delete facilities
- ❌ Cannot access admin features

## API Endpoints

### Authentication
- `GET /login` - Display login form
- `POST /login` - Submit login credentials
- `GET /logout` - Logout

### Facilities (All require authentication)
- `GET /api/facilities/list` - List all facilities
- `GET /api/facilities/facility-list` - Get facility dropdown list
- `POST /api/facilities/upload` - Upload database (multipart/form-data)
- `GET /api/facilities/:id` - Get facility details
- `PUT /api/facilities/:id` - Update facility (admin only)
- `DELETE /api/facilities/:id` - Delete facility (admin only)
- `POST /api/facilities/:id/restore-dump` - View database metadata (admin only)
- `GET /api/facilities/download/:id` - Download database file (admin only)
- `GET /api/facilities/report/download` - Download upload report (admin only)

### Users (Admin only)
- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `POST /api/users/:id/reset-password` - Reset user password

### Monitoring
- `GET /health` - Health check endpoint

## File Structure

```
facility-upload-app/
├── server.js                    # Main application entry point
├── db.js                        # PostgreSQL connection pool
├── package.json                 # Project dependencies
├── .env.example                 # Environment variables template
├── .gitignore                   # Git ignore rules
├── config/
│   └── config.js               # Environment configuration
├── middleware/
│   ├── authMiddleware.js        # Authentication & authorization
│   ├── validationMiddleware.js  # Input validation & sanitization
│   └── logger.js                # Request logging
├── routes/
│   ├── login.js                 # Login routes
│   ├── facilities.js            # Facility routes
│   └── users.js                 # User management routes
├── controllers/
│   ├── facilityController.js    # Facility business logic
│   ├── loginController.js       # Login business logic
│   └── userController.js        # User management logic
├── views/
│   ├── index.ejs                # Main dashboard
│   ├── login.ejs                # Login page
│   ├── users.ejs                # User management
│   └── error.ejs                # Error page
├── public/
│   ├── app.js                   # Client-side JavaScript
│   └── styles.css               # Styling
├── utils/
│   └── pgdumpUtils.js           # PostgreSQL utilities
├── uploads/                     # Uploaded files directory
├── logs/                        # Application logs
└── README.md                    # This file
```

## Database Schema

### users table
```sql
id (SERIAL PRIMARY KEY)
username (VARCHAR 100, UNIQUE NOT NULL)
password (VARCHAR 255 NOT NULL)
email (VARCHAR 100)
role (VARCHAR 20 DEFAULT 'uploader', CHECK IN ('admin', 'uploader'))
created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
```

### facility_list table
```sql
id (SERIAL PRIMARY KEY)
facility_name (VARCHAR 255, UNIQUE NOT NULL)
facility_code (VARCHAR 50, UNIQUE NOT NULL)
created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
```

### facilities table
```sql
id (SERIAL PRIMARY KEY)
facility_id (INT REFERENCES facility_list)
facility_name (VARCHAR 255 NOT NULL)
facility_code (VARCHAR 50 NOT NULL)
description (TEXT)
file_path (VARCHAR 500)
uploaded_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
```

## Security Configuration

### Security Headers
- Helmet.js adds the following headers:
  - Content-Security-Policy
  - Strict-Transport-Security
  - X-Frame-Options
  - X-Content-Type-Options
  - X-XSS-Protection

### Rate Limiting
- General routes: 100 requests per 15 minutes
- Authentication routes: 5 requests per 15 minutes

### Input Validation
- Email format validation
- Username format (3-32 chars, alphanumeric + underscore)
- Password strength requirements
- XSS protection via sanitization
- SQL injection prevention via parameterized queries

### Session Security
- HTTPOnly cookies (prevents JavaScript access)
- Secure flag in production (HTTPS only)
- SameSite=strict (CSRF protection)
- 24-hour expiration

## Logging

Logs are stored in the `logs/` directory:

- `error.log` - Error level logs
- `warn.log` - Warning level logs
- `info.log` - Info level logs
- `debug.log` - Debug level logs

Log format: `{ timestamp, level, message, data }`

## Deployment Guide

### Prerequisites
- Node.js v14+ installed
- PostgreSQL v12+ running
- PM2 or Docker for process management

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start server.js --name "facility-app"

# View logs
pm2 logs facility-app

# Restart on reboot
pm2 startup
pm2 save
```

### Using Docker

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment-Specific Configuration

**Development (.env)**
```env
NODE_ENV=development
PORT=3000
DB_PASSWORD=dev_password
SESSION_SECRET=dev_secret_not_secure
```

**Production (.env.production)**
```env
NODE_ENV=production
PORT=3000
DB_HOST=production-db.example.com
DB_PASSWORD=strong_production_password
SESSION_SECRET=strong_random_secret_32_chars
JWT_SECRET=strong_random_secret_32_chars
```

## Monitoring & Maintenance

### Health Checks
```bash
curl http://localhost:3000/health
# Response: { "status": "OK", "timestamp": "...", "uptime": ... }
```

### Log Monitoring
```bash
# Tail error logs
tail -f logs/error.log

# View recent errors
head -20 logs/error.log | jq .
```

### Database Backups
```bash
# Backup
pg_dump facilities_db > backup_$(date +%Y%m%d).sql

# Restore
psql facilities_db < backup_20240101.sql
```

## Troubleshooting

### Port Already in Use
```bash
# Change PORT in .env or kill process
lsof -i :3000
kill -9 <PID>
```

### Database Connection Error
- Ensure PostgreSQL is running
- Verify credentials in `.env`
- Check database exists: `psql -l`

### CSRF Token Error
- Clear browser cookies
- Ensure session secret is set in `.env`
- Try in incognito mode

### File Upload Fails
- Check `uploads/` directory has write permissions: `chmod 755 uploads/`
- Verify file is valid PostgreSQL dump
- Check file size (max 2GB)

## Performance Optimization

### Implemented
- ✅ Connection pooling for database
- ✅ Parameterized queries (prevents SQL injection)
- ✅ Compression middleware (built-in Node.js)
- ✅ Static file caching headers

### Recommended for High Traffic
- Use load balancer (nginx)
- Enable database query caching
- Implement Redis for session storage
- Use CDN for static files
- Enable database replication

## Support & Issues

For issues, questions, or contributions:
1. Check the logs in `logs/` directory
2. Enable debug logging: `LOG_LEVEL=debug`
3. Review error messages in browser console
4. Check environment variables are set correctly

## License

ISC

---

**Last Updated**: November 2024  
**Version**: 1.1.0 - Production Ready
