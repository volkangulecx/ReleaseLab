# ReleaseLab - Development Guide

## Quick Start

```bash
# Start infrastructure
cd deploy/docker && docker-compose up -d postgres redis minio

# Run API (port 5000)
dotnet run --project src/Api/ReleaseLab.Api --urls http://localhost:5000

# Run Worker (needs FFmpeg in PATH)
dotnet run --project src/Workers/ReleaseLab.Worker.Mastering

# Run Frontend (port 3000)
cd frontend && npm run dev
```

## Architecture

- **Clean Architecture**: Domain → Application → Infrastructure → API
- **Monolith-modular**: Single API deployment, separate Worker process
- **Queue**: Redis (BRPOP with priority lanes: high/normal/low)
- **Storage**: MinIO (S3-compatible), pre-signed URLs for upload/download
- **Auth**: JWT (15min access + 30day refresh), BCrypt passwords

## Key Conventions

- All entities in `src/Core/ReleaseLab.Domain/Entities/`
- Interfaces in `src/Core/ReleaseLab.Application/Interfaces/`
- EF Core configurations in `src/Infrastructure/ReleaseLab.Infrastructure.Data/Configurations/`
- Queue messages in `src/Core/ReleaseLab.Contracts/Messages/`
- Frontend pages follow Next.js App Router in `frontend/src/app/`

## Testing

```bash
dotnet test                           # All 89 tests
dotnet test tests/ReleaseLab.UnitTests        # 40 unit tests
dotnet test tests/ReleaseLab.Worker.Tests     # 40 worker tests
dotnet test tests/ReleaseLab.IntegrationTests # 9 integration tests
```

## Database

- PostgreSQL via EF Core, migrations in `src/Infrastructure/ReleaseLab.Infrastructure.Data/Migrations/`
- Auto-migrate on startup in Development mode
- Design-time factory for `dotnet ef` commands

```bash
dotnet ef migrations add <Name> \
  --project src/Infrastructure/ReleaseLab.Infrastructure.Data \
  --startup-project src/Api/ReleaseLab.Api \
  --output-dir Migrations
```

## Seed Users

- **Admin**: admin@releaselab.io / Admin123! (IsAdmin=true, Studio plan)
- **Demo**: demo@releaselab.io / Demo123! (Pro plan, 10 credits)

## Environment

- .NET 8, Node.js 20+, FFmpeg required for Worker
- Dev config in `appsettings.json`, production via environment variables
- Docker Compose for all infrastructure (PostgreSQL, Redis, MinIO, Prometheus, Grafana, Jaeger)
