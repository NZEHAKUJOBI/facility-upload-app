-- Create database
CREATE DATABASE facilities_db;

-- Connect to the database
\c facilities_db

-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create facility_list table (master list of all facilities)
CREATE TABLE facility_list (
    id SERIAL PRIMARY KEY,
    facility_name VARCHAR(255) NOT NULL UNIQUE,
    facility_code VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create facilities table (uploaded database information)
CREATE TABLE facilities (
    id SERIAL PRIMARY KEY,
    facility_id INT REFERENCES facility_list(id),
    facility_name VARCHAR(255) NOT NULL,
    facility_code VARCHAR(50) NOT NULL,
    description TEXT,
    file_path VARCHAR(500),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on facility_code for faster lookups
CREATE INDEX idx_facility_code ON facilities(facility_code);

-- Create index on uploaded_at for sorting
CREATE INDEX idx_uploaded_at ON facilities(uploaded_at DESC);

-- Create index on facility_list codes
CREATE INDEX idx_facility_list_code ON facility_list(facility_code);

-- Create index on users
CREATE INDEX idx_username ON users(username);
