#!/bin/bash
set -e

echo "=== ReleaseLab Development Setup ==="
echo ""

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed."; exit 1; }
command -v dotnet >/dev/null 2>&1 || { echo ".NET SDK is required but not installed."; exit 1; }

echo "[1/4] Starting infrastructure (PostgreSQL, Redis, MinIO)..."
cd "$(dirname "$0")/../docker"
docker-compose up -d postgres redis minio
echo "Waiting for services to be ready..."
sleep 5

echo ""
echo "[2/4] Restoring NuGet packages..."
cd ../..
dotnet restore

echo ""
echo "[3/4] Applying database migrations..."
dotnet ef database update \
  --project src/Infrastructure/ReleaseLab.Infrastructure.Data \
  --startup-project src/Api/ReleaseLab.Api

echo ""
echo "[4/4] Building solution..."
dotnet build

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Infrastructure:"
echo "  PostgreSQL: localhost:5432 (rl/rl)"
echo "  Redis:      localhost:6379"
echo "  MinIO:      localhost:9000 (console: localhost:9001)"
echo "              User: minioadmin / Password: minioadmin"
echo ""
echo "Seed users:"
echo "  Admin: admin@releaselab.io / Admin123!"
echo "  Demo:  demo@releaselab.io / Demo123!"
echo ""
echo "Run the API:"
echo "  dotnet run --project src/Api/ReleaseLab.Api"
echo ""
echo "Run the worker:"
echo "  dotnet run --project src/Workers/ReleaseLab.Worker.Mastering"
echo ""
echo "Swagger UI: http://localhost:5000/swagger"
