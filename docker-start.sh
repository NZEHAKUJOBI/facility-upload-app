#!/bin/bash
set -e

echo "================================"
echo "Facility Upload App - Docker Setup"
echo "================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose found"

# Copy .env.docker to .env if .env doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.docker..."
    cp .env.docker .env
    echo "⚠️  Please update .env with your configuration before deploying!"
fi

# Build and start containers
echo "🐳 Building Docker images..."
docker-compose build --no-cache

echo "🚀 Starting containers..."
docker-compose up -d

echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check if app is running
if docker-compose ps | grep -q "facility-upload-app.*Up"; then
    echo "✅ Application is running!"
    echo ""
    echo "================================"
    echo "🌐 Access your app at:"
    echo "   http://localhost:3000"
    echo "================================"
    echo ""
    echo "📊 Database:"
    echo "   Host: localhost:5432"
    echo "   User: postgres"
    echo "================================"
    echo ""
    echo "📝 Useful commands:"
    echo "   View logs:  docker-compose logs -f app"
    echo "   Stop:       docker-compose down"
    echo "   Restart:    docker-compose restart"
    echo "================================"
else
    echo "❌ Failed to start application. Check logs:"
    docker-compose logs app
    exit 1
fi
