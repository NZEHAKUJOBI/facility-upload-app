# Facility Database Upload App

An Express.js application for uploading PostgreSQL database information for multiple facilities (up to 11).

## Features

- Upload facility information with database files
- Support for CSV, JSON, and SQL file formats
- View all uploaded facilities
- Edit facility details
- Delete facilities
- Maximum limit of 11 facilities
- Clean, responsive web interface

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm

## Installation

1. Clone or navigate to the project directory:
```bash
cd facility-upload-app
```

2. Install dependencies:
```bash
npm install
```

3. Set up the PostgreSQL database:
```bash
# Connect to PostgreSQL
psql -U postgres

# Run the initialization script
\i init-db.sql
```

4. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

5. Update the `.env` file with your PostgreSQL credentials:
```
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=facilities_db
DB_USER=postgres
DB_PASSWORD=your_password
MAX_FACILITIES=11
UPLOAD_FOLDER=./uploads
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

The application will start on `http://localhost:3000`

## API Endpoints

### Upload Facility
- **POST** `/api/facilities/upload`
- Required fields: `facility_name`, `facility_code`
- Optional fields: `description`, `file`

Example:
```bash
curl -X POST http://localhost:3000/api/facilities/upload \
  -F "facility_name=Hospital A" \
  -F "facility_code=FAC001" \
  -F "description=Main hospital facility" \
  -F "file=@database.sql"
```

### List All Facilities
- **GET** `/api/facilities/list`

### Get Facility by ID
- **GET** `/api/facilities/:id`

### Update Facility
- **PUT** `/api/facilities/:id`
- Fields: `facility_name`, `facility_code`, `description` (all optional)

### Delete Facility
- **DELETE** `/api/facilities/:id`

## File Structure

```
facility-upload-app/
├── server.js                 # Main application entry point
├── db.js                     # PostgreSQL connection pool
├── package.json             # Project dependencies
├── .env.example             # Environment variables template
├── init-db.sql              # Database initialization script
├── routes/
│   └── facilities.js        # Route handlers for facilities
├── controllers/
│   └── facilityController.js # Business logic for facilities
├── views/
│   └── index.ejs            # Main HTML template
├── public/
│   ├── app.js               # Client-side JavaScript
│   └── styles.css           # Styling
├── uploads/                 # Directory for uploaded files
└── README.md                # This file
```

## Database Schema

### facilities table
- `id` (SERIAL PRIMARY KEY): Unique identifier
- `facility_name` (VARCHAR 255): Name of the facility
- `facility_code` (VARCHAR 50): Unique code for the facility
- `description` (TEXT): Optional description
- `file_path` (VARCHAR 500): Path to uploaded database file
- `uploaded_at` (TIMESTAMP): Upload timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

## Configuration

Edit the `.env` file to customize:

- `PORT`: Server port (default: 3000)
- `DB_HOST`: PostgreSQL host
- `DB_PORT`: PostgreSQL port
- `DB_NAME`: Database name
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `MAX_FACILITIES`: Maximum number of facilities (default: 11)
- `UPLOAD_FOLDER`: Directory to store uploaded files

## Security Notes

- File uploads are restricted to CSV, JSON, and SQL formats
- File upload size limits can be added if needed
- Implement authentication before deploying to production
- Use environment variables for sensitive data
- Validate all inputs on both client and server

## Troubleshooting

### Connection to PostgreSQL fails
- Ensure PostgreSQL is running
- Check credentials in `.env`
- Verify database exists

### File upload fails
- Check that `uploads/` directory is writable
- Verify file format is supported
- Check file size isn't too large

### Port already in use
- Change `PORT` in `.env` file
- Or kill the process using the port

## Next Steps

- Add user authentication
- Implement database validation for uploaded files
- Add backup/export functionality
- Add facility search and filtering
- Implement role-based access control
- Add activity logging

## License

ISC



Quick Start:
Open PowerShell/cmd in the facility-upload-app directory
Run: npm install
Create .env file from .env.example with your PostgreSQL credentials
Create the database: psql -U postgres -f init-db.sql
Run: npm start (or npm run dev for development with auto-reload)
Visit http://localhost:3000
