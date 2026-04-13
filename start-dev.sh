#!/bin/bash
# ReleaseLab Development Startup Script
# Starts all services with hot-reload

set -e

FFMPEG_DIR="/c/Users/volka/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1-full_build/bin"
export PATH="$PATH:/c/Program Files/dotnet:$FFMPEG_DIR"

echo "╔══════════════════════════════════╗"
echo "║     ReleaseLab Dev Server        ║"
echo "╚══════════════════════════════════╝"
echo ""

# Check Docker
echo "[1/4] Checking infrastructure..."
docker ps --format "  {{.Names}}: {{.Status}}" 2>/dev/null | grep -E "postgres|redis|minio" || {
    echo "  Starting Docker containers..."
    cd deploy/docker && docker-compose up -d postgres redis minio && cd ../..
    sleep 3
}
echo "  Infrastructure: OK"

# Clear old queues
echo ""
echo "[2/4] Clearing stale queues..."
docker exec docker-redis-1 redis-cli DEL queue:mastering:priority-high queue:mastering:priority-normal queue:mastering:priority-low queue:mastering:processing 2>/dev/null || true
echo "  Queues: cleared"

# Start API with watch (hot-reload)
echo ""
echo "[3/4] Starting API + Worker..."
cd "$(dirname "$0")"

dotnet watch run --project src/Api/ReleaseLab.Api --urls "http://localhost:5000" &
API_PID=$!

sleep 2
dotnet watch run --project src/Workers/ReleaseLab.Worker.Mastering &
WORKER_PID=$!

# Start Frontend
echo ""
echo "[4/4] Starting Frontend..."
cd frontend && npx next dev --port 3001 &
FRONTEND_PID=$!
cd ..

echo ""
echo "╔══════════════════════════════════╗"
echo "║  All services running!           ║"
echo "║                                  ║"
echo "║  Frontend: http://localhost:3001  ║"
echo "║  API:      http://localhost:5000  ║"
echo "║  Swagger:  http://localhost:5000/swagger ║"
echo "║  MinIO:    http://localhost:9001  ║"
echo "║                                  ║"
echo "║  Login: demo@releaselab.io       ║"
echo "║  Pass:  Demo123!                 ║"
echo "║                                  ║"
echo "║  Press Ctrl+C to stop all        ║"
echo "╚══════════════════════════════════╝"

# Trap Ctrl+C to kill all
trap "echo 'Stopping...'; kill $API_PID $WORKER_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

wait
