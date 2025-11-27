# Facility Database Upload API Documentation

## Overview

This document describes the RESTful API for the Facility Database Upload application. All endpoints require authentication via session cookies and CSRF protection for state-changing operations (POST, PUT, DELETE).

## Base URL

- Development: `http://localhost:3000`
- Production: `https://api.example.com`

## Authentication

### Session Authentication
- Login via POST `/login` to obtain a session cookie
- Session is maintained via `connect.sid` cookie with secure, httpOnly flags
- All authenticated requests must include the session cookie
- Session timeout: 24 hours

### CSRF Protection
- POST, PUT, DELETE requests require `csrf-token` header
- CSRF token is provided in forms via hidden `_csrf` input
- Token is validated on every state-changing request

### Rate Limiting
- General routes: 100 requests per 15 minutes
- Authentication routes: 5 login attempts per 15 minutes
- Exceeding limits returns 429 Too Many Requests

## Response Format

All API responses follow a consistent JSON format:

**Success Response (2xx):**
```json
{
  "success": true,
  "message": "Operation description",
  "data": { /* response data */ }
}
```

**Error Response (4xx, 5xx):**
```json
{
  "success": false,
  "message": "Error description"
}
```

## HTTP Status Codes

- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid input or validation failure
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions or CSRF token invalid
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

## User Input Validation

### Username
- Length: 3-32 characters
- Pattern: Alphanumeric + underscore only
- Example: `john_doe_123`

### Password
- Minimum: 8 characters
- Required: At least one uppercase letter
- Required: At least one lowercase letter
- Required: At least one digit
- Example: `SecurePassword123`

### Email
- Format: Standard email format
- Example: `user@example.com`

### Facility Code
- Length: 3-20 characters
- Pattern: Uppercase letters, numbers, underscore, hyphen
- Example: `FAC-001_HQ`

---

## Endpoints

### Authentication

#### Login
```
POST /login
Content-Type: application/x-www-form-urlencoded
No Authentication Required
```

**Request Body:**
```
username=john_doe
password=MyPassword123
_csrf=<token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful"
}
```

**Error Response (401):**
```json
{
  "success": false,
  "message": "Invalid username or password"
}
```

#### Logout
```
GET /logout
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### Facilities

#### List All Facilities
```
GET /api/facilities/list
Authentication: Required
```

**Success Response (200):**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": 1,
      "facility_name": "Main Hospital",
      "facility_code": "MH-001",
      "description": "Primary medical facility",
      "file_path": "./uploads/facility_1.sql",
      "uploaded_at": "2024-11-27T10:30:00Z",
      "updated_at": "2024-11-27T10:30:00Z"
    }
  ]
}
```

#### Get Facility Dropdown List
```
GET /api/facilities/facility-list
Authentication: Required
```

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "facility_name": "Main Hospital",
      "facility_code": "MH-001"
    }
  ]
}
```

#### Get Facility by ID
```
GET /api/facilities/:id
Authentication: Required
```

**Path Parameters:**
- `id` (integer): Facility ID

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "facility_name": "Main Hospital",
    "facility_code": "MH-001",
    "description": "Primary medical facility",
    "file_path": "./uploads/facility_1.sql",
    "uploaded_at": "2024-11-27T10:30:00Z",
    "updated_at": "2024-11-27T10:30:00Z"
  }
}
```

#### Upload Database
```
POST /api/facilities/upload
Content-Type: multipart/form-data
Authentication: Required (Any role)
CSRF: Required
Rate Limit: 100 per 15 minutes
```

**Request Body (Form Data):**
- `facility_name` (string, required): Facility name
- `facility_code` (string, required): Facility code (3-20 chars, uppercase+digits+underscore+hyphen)
- `description` (string, optional): Facility description
- `file` (file, optional): PostgreSQL dump file (.sql, .dump, .bak, .backup)
- `_csrf` (string, required): CSRF token

**Success Response (201):**
```json
{
  "success": true,
  "message": "Facility uploaded successfully",
  "data": {
    "id": 1,
    "facility_name": "Main Hospital",
    "facility_code": "MH-001",
    "description": "Primary medical facility",
    "file_path": "./uploads/facility_1.sql",
    "uploaded_at": "2024-11-27T10:30:00Z"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "facility_name and facility_code are required"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Facility code must be 3-20 characters (uppercase, numbers, underscore, hyphen only)"
}
```

#### Update Facility
```
PUT /api/facilities/:id
Content-Type: application/json
Authentication: Required (Admin only)
CSRF: Required
```

**Path Parameters:**
- `id` (integer): Facility ID

**Request Body:**
```json
{
  "facility_name": "Updated Hospital Name",
  "facility_code": "MH-002",
  "description": "Updated description"
}
```

**Headers:**
```
csrf-token: <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Facility updated successfully",
  "data": { /* updated facility */ }
}
```

#### Delete Facility
```
DELETE /api/facilities/:id
Authentication: Required (Admin only)
CSRF: Required
```

**Path Parameters:**
- `id` (integer): Facility ID

**Headers:**
```
csrf-token: <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Facility deleted successfully"
}
```

#### Restore Database Dump Metadata
```
POST /api/facilities/:id/restore-dump
Authentication: Required (Admin only)
CSRF: Required
```

**Path Parameters:**
- `id` (integer): Facility ID

**Headers:**
```
csrf-token: <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "metadata": {
      "version": "PostgreSQL 12.0",
      "dumpDate": "2024-11-27T10:30:00Z",
      "tables": ["users", "facilities", "facility_list"],
      "tableCount": 3
    }
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Database file not found"
}
```

#### Download Database File
```
GET /api/facilities/download/:id
Authentication: Required (Admin only)
```

**Path Parameters:**
- `id` (integer): Facility ID

**Success Response (200):**
- Returns binary file content with `Content-Disposition: attachment`
- File download initiated

**Error Response (400):**
```json
{
  "success": false,
  "message": "Database file not found"
}
```

#### Download Upload Report
```
GET /api/facilities/report/download
Authentication: Required (Admin only)
```

**Success Response (200):**
- Returns CSV file with columns:
  - Facility Name
  - Facility Code
  - Description
  - Uploaded Date
  - File Size
  - File Path

**Example CSV:**
```
Facility Name,Facility Code,Description,Uploaded Date,File Size,File Path
Main Hospital,MH-001,Primary medical facility,2024-11-27,102.5 MB,./uploads/facility_1.sql
```

---

### Users (Admin Only)

#### List All Users
```
GET /api/users
Authentication: Required (Admin only)
```

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "role": "admin",
      "created_at": "2024-11-27T10:30:00Z"
    },
    {
      "id": 2,
      "username": "uploader1",
      "email": "user@example.com",
      "role": "uploader",
      "created_at": "2024-11-27T11:00:00Z"
    }
  ]
}
```

#### Create User
```
POST /api/users
Content-Type: application/json
Authentication: Required (Admin only)
CSRF: Required
Rate Limit: 5 per 15 minutes (auth routes)
```

**Request Body:**
```json
{
  "username": "newuser",
  "password": "SecurePassword123",
  "email": "newuser@example.com",
  "role": "uploader"
}
```

**Headers:**
```
csrf-token: <token>
```

**Validation:**
- Username: 3-32 characters, alphanumeric + underscore
- Password: 8+ characters, must contain uppercase, lowercase, and digit
- Email: Valid email format
- Role: "admin" or "uploader"

**Success Response (201):**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": 3,
    "username": "newuser",
    "email": "newuser@example.com",
    "role": "uploader",
    "created_at": "2024-11-27T12:00:00Z"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Username must be 3-32 characters (alphanumeric and underscore only)"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Password must be at least 8 characters with uppercase, lowercase, and number"
}
```

#### Update User
```
PUT /api/users/:id
Content-Type: application/json
Authentication: Required (Admin only)
CSRF: Required
```

**Path Parameters:**
- `id` (integer): User ID

**Request Body:**
```json
{
  "email": "newemail@example.com",
  "role": "admin"
}
```

**Headers:**
```
csrf-token: <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": { /* updated user */ }
}
```

#### Delete User
```
DELETE /api/users/:id
Authentication: Required (Admin only)
CSRF: Required
```

**Path Parameters:**
- `id` (integer): User ID

**Headers:**
```
csrf-token: <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Cannot delete the last admin user"
}
```

#### Reset User Password
```
POST /api/users/:id/reset-password
Content-Type: application/json
Authentication: Required (Admin only)
CSRF: Required
```

**Path Parameters:**
- `id` (integer): User ID

**Request Body:**
```json
{
  "newPassword": "NewSecurePassword123"
}
```

**Headers:**
```
csrf-token: <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": { /* user without password */ }
}
```

---

### Health & Monitoring

#### Health Check
```
GET /health
Authentication: Not Required
```

**Success Response (200):**
```json
{
  "status": "OK",
  "timestamp": "2024-11-27T12:00:00.000Z",
  "uptime": 3600
}
```

---

## Error Codes

### Validation Errors (400)
- Missing required fields
- Invalid input format
- Invalid role specified
- Facility code limit reached
- File too large

### Authentication Errors (401)
- Invalid credentials
- Session expired
- User not authenticated

### Authorization Errors (403)
- User lacks required permissions (admin-only endpoint)
- CSRF token invalid or missing
- Cannot delete last admin user

### Not Found Errors (404)
- User not found
- Facility not found
- File not found

### Rate Limit Errors (429)
- Too many requests
- Account temporarily locked after failed attempts

### Server Errors (500)
- Database connection error
- File system error
- Unexpected error

---

## Examples

### Complete Upload Flow

1. **Get CSRF Token (embedded in login page)**
2. **Upload Database:**
```bash
curl -X POST http://localhost:3000/api/facilities/upload \
  -H "csrf-token: <your_csrf_token>" \
  -F "facility_name=Main Hospital" \
  -F "facility_code=MH-001" \
  -F "description=Primary facility" \
  -F "file=@database.sql" \
  -b "connect.sid=<your_session_cookie>"
```

3. **Get Database Metadata:**
```bash
curl -X POST http://localhost:3000/api/facilities/1/restore-dump \
  -H "csrf-token: <your_csrf_token>" \
  -b "connect.sid=<your_session_cookie>"
```

4. **Download Database File:**
```bash
curl -X GET http://localhost:3000/api/facilities/download/1 \
  -b "connect.sid=<your_session_cookie>" \
  -o facility_backup.sql
```

### Create User Flow

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -H "csrf-token: <your_csrf_token>" \
  -d '{
    "username": "john_doe",
    "password": "SecurePass123",
    "email": "john@example.com",
    "role": "uploader"
  }' \
  -b "connect.sid=<your_session_cookie>"
```

---

## Security Considerations

1. **HTTPS**: Always use HTTPS in production
2. **CSRF Tokens**: Required for all state-changing operations
3. **Rate Limiting**: Protects against brute force attacks
4. **Input Validation**: All inputs sanitized and validated
5. **Password Security**: Stored with bcrypt (10 rounds)
6. **Session Security**: HTTPOnly, Secure, SameSite cookies
7. **Logging**: All requests logged with timestamps and user info
8. **Database**: Parameterized queries prevent SQL injection

---

## Rate Limiting Details

### Global Rate Limit
- 100 requests per 15 minutes per IP
- Returns 429 status when exceeded

### Auth Rate Limit
- 5 login attempts per 15 minutes per IP
- Resets on successful login

---

## Changelog

### Version 1.1.0
- Added CSRF protection to all forms
- Implemented Helmet security headers
- Added rate limiting middleware
- Enhanced input validation
- Added request logging
- Added health check endpoint
- Implemented graceful shutdown
- Added comprehensive API documentation

### Version 1.0.0
- Initial release with basic CRUD operations
- User authentication with roles
- File upload with progress tracking
- Database metadata extraction
