# Docker Deployment Guide

## Prerequisites

- **Docker**: [Install Docker](https://docs.docker.com/get-docker/)
- **Docker Compose**: [Install Docker Compose](https://docs.docker.com/compose/install/)

## Quick Start

### 1. Configure Environment Variables

```bash
# Copy template to .env
cp .env.docker .env

# Edit .env with your settings
# Important: Change these in production:
# - DB_PASSWORD
# - SESSION_SECRET
# - NODE_ENV (set to 'production')
```

### 2. Start the Application

**Using Script (Linux/Mac):**
```bash
chmod +x docker-start.sh
./docker-start.sh
```

**Using Docker Compose (All Platforms):**
```bash
docker-compose up -d
```

### 3. Access the Application

- **Web App**: http://localhost:3000
- **PostgreSQL**: localhost:5432
- **Nginx**: http://localhost:80 (if enabled)

## Architecture

### Services:

1. **PostgreSQL 15** (postgres)
   - Database container
   - Port: 5432
   - Volume: `postgres_data` (persistent storage)

2. **Node.js App** (app)
   - Facility Upload application
   - Port: 3000
   - Depends on: PostgreSQL
   - Volumes: `./uploads`, `./logs`

3. **Nginx** (nginx) - Optional Reverse Proxy
   - Load balancing & SSL termination
   - Ports: 80 (HTTP), 443 (HTTPS)
   - Configured for large file uploads (2GB limit)

## Common Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f postgres
```

### Stop Services
```bash
docker-compose down
```

### Restart Services
```bash
docker-compose restart
docker-compose restart app
```

### Database Access
```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U postgres -d facilities_db

# Backup database
docker-compose exec postgres pg_dump -U postgres facilities_db > backup.sql

# Restore database
docker-compose exec -T postgres psql -U postgres facilities_db < backup.sql
```

### View Application Logs
```bash
docker-compose logs -f app --tail=100
```

## Production Deployment

### 1. Enable HTTPS

Uncomment the HTTPS section in `nginx.conf`:
- Place SSL certificates in `./ssl/` directory
- Update `server_name` to your domain

### 2. Security Settings

```env
# .env
NODE_ENV=production
SESSION_SECRET=<generate-random-string>
DB_PASSWORD=<strong-password>
```

### 3. Environment Setup

```bash
# Set proper permissions
chmod 600 .env
chmod 700 ssl/

# Create required directories
mkdir -p uploads/backups uploads/chunks logs
chmod 755 uploads logs
```

### 4. Monitoring & Health Checks

- **App Health**: `/health` endpoint
- **Docker Health**: `docker-compose ps` (shows health status)
- **Logs**: `docker-compose logs -f app`

### 5. Scaling (Multiple Instances)

Create multiple app services in docker-compose.yml:
```yaml
app2:
  build: .
  depends_on:
    postgres:
      condition: service_healthy
  environment:
    DB_HOST: postgres
  # ... other config
```

Then use Nginx to load balance between instances.

## Troubleshooting

### Application fails to start
```bash
docker-compose logs app
```

### Database connection error
```bash
# Check if postgres is running
docker-compose ps

# Wait for postgres to be healthy
docker-compose up postgres
```

### Port already in use
Change ports in `docker-compose.yml` or `.env`:
```env
APP_PORT=3001  # Instead of 3000
```

### Permissions error on uploads folder
```bash
docker-compose exec app chmod 755 /app/uploads
```

### Clear all data (warning: destructive)
```bash
docker-compose down -v
# -v removes all volumes (including database)
```

## Network

All services communicate via `facility-network` bridge network:
- `app` → `postgres:5432`
- `nginx` → `app:3000`

## File Structure

```
facility-upload-app/
├── Dockerfile              # App container image
├── docker-compose.yml      # Multi-container orchestration
├── .env.docker            # Environment template
├── .dockerignore           # Files to exclude from image
├── nginx.conf             # Reverse proxy configuration
├── docker-start.sh        # Quick start script
├── DOCKER_README.md       # This file
├── uploads/               # Persistent file storage
│   ├── chunks/           # Temporary chunk files
│   └── backups/          # Database backups
├── logs/                  # Application logs
└── ... (app files)
```

## Data Persistence

### Volumes:
- **postgres_data**: PostgreSQL database files
- **./uploads**: User uploaded files
- **./logs**: Application logs

These are preserved when containers stop and restart.

### Backup Strategy
```bash
# Backup database
docker-compose exec postgres pg_dump -U postgres facilities_db > backup_$(date +%Y%m%d).sql

# Backup uploads
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz uploads/

# Restore database
docker-compose exec -T postgres psql -U postgres facilities_db < backup_20231128.sql
```

## Support & Issues

- Check logs: `docker-compose logs -f`
- Verify Docker installation: `docker --version`
- Verify Docker Compose: `docker-compose --version`

