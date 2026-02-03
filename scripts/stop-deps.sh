#!/bin/bash
# Stop Docker Compose services

echo "Stopping development dependencies..."
docker-compose down

echo "✅ Services stopped successfully!"
