<p align="center">
  <h1 align="center">ReleaseLab</h1>
  <p align="center">
    <strong>Studio-quality mastering without a studio.</strong><br/>
    Upload &rarr; Master &rarr; Release
  </p>
</p>

<p align="center">
  <a href="#features">Features</a> &bull;
  <a href="#tech-stack">Tech Stack</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#api-endpoints">API Endpoints</a> &bull;
  <a href="#project-structure">Project Structure</a> &bull;
  <a href="#testing">Testing</a> &bull;
  <a href="#deployment">Deployment</a>
</p>

---

ReleaseLab is a cloud-based music mastering platform that lets independent artists and producers get professional-sounding masters in minutes. Choose a preset, upload your mix, and download a mastered track -- no audio engineering experience required.

## Features

- **One-click mastering** -- 4 DSP presets (Warm, Bright, Loud, Balanced) powered by FFmpeg
- **Real-time progress** -- Server-Sent Events stream job status to the browser
- **A/B comparison** -- Listen to your original mix and mastered track side by side with waveform visualization
- **Direct-to-S3 uploads** -- Large files stream straight to MinIO/S3 via pre-signed URLs; the API never proxies bytes
- **Credit & subscription billing** -- Stripe-powered credit packs and monthly plans (Free / Pro / Studio)
- **Admin dashboard** -- User management, job monitoring, manual credit grants, refunds
- **Queue-based processing** -- Redis queues with retry, dead-letter, and priority lanes
- **Observability from day one** -- Structured logging (Serilog), OpenTelemetry tracing, Prometheus metrics
- **JWT authentication** -- Access + refresh token flow with rate limiting

## Tech Stack

| Layer | Technology |
|---|---|
| **API** | .NET 8, ASP.NET Core, MediatR (CQRS), FluentValidation |
| **Auth** | JWT Bearer + BCrypt, refresh tokens |
| **Database** | PostgreSQL 16 + EF Core (Npgsql) |
| **Cache / Queue** | Redis 7 (StackExchange.Redis) |
| **Object Storage** | MinIO (S3-compatible) via AWS SDK |
| **Payments** | Stripe.net (checkout sessions, webhooks) |
| **Audio Processing** | FFmpeg (Xabe.FFmpeg wrapper) |
| **Observability** | Serilog, OpenTelemetry, Prometheus |
| **Resilience** | Polly |
| **Frontend** | Next.js 14, React 18, TypeScript |
| **Styling** | Tailwind CSS (dark theme) |
| **State Management** | Zustand |
| **CI/CD** | GitHub Actions (build, test, Docker) |
| **Containerisation** | Docker, Docker Compose, Nginx |

## Architecture

```
                              HTTPS
  ┌──────────────┐       ┌──────────────────────────────────────┐
  │   Frontend   │◄─────►│       Nginx (reverse proxy)          │
  │  (Next.js)   │       └──────────────┬───────────────────────┘
  └──────────────┘                      │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
          ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
          │   Auth API     │  │   Core API     │  │  Upload API    │
          │   (.NET 8)     │  │   (.NET 8)     │  │  (.NET 8)      │
          └───────┬────────┘  └───────┬────────┘  └───────┬────────┘
                  └─────────┬─────────┴─────────┬─────────┘
                            ▼                   ▼
                   ┌──────────────┐    ┌──────────────────┐
                   │  PostgreSQL  │    │      Redis       │
                   │  (primary)   │    │ (queue + cache)  │
                   └──────────────┘    └───────┬──────────┘
                                               │
                                               ▼
                                  ┌──────────────────────┐
                                  │  Mastering Worker    │
                                  │  (.NET 8 + FFmpeg)   │
                                  └──────────┬───────────┘
                                             ▼
                                  ┌──────────────────────┐
                                  │    MinIO (S3)        │
                                  │  raw + processed     │
                                  └──────────────────────┘

                   ┌────────────────┐    ┌────────────────┐
                   │ Stripe Webhook │───►│ Payment Service│
                   └────────────────┘    └────────────────┘
```

**Clean Architecture layers:**

```
  Domain  ──►  Application  ──►  Infrastructure  ──►  API / Worker
 (entities,   (use cases,      (EF Core, Redis,     (controllers,
  enums,       interfaces,      S3, Stripe,          background
  value        DTOs, CQRS)      FFmpeg, email)       services)
  objects)
```

## Quick Start

### Prerequisites

| Tool | Version |
|---|---|
| .NET SDK | 8.0+ |
| Node.js | 20+ |
| Docker & Docker Compose | latest |
| FFmpeg | 6.0+ (included in worker Docker image) |

### 1. Clone the repository

```bash
git clone https://github.com/your-org/ReleaseLab.git
cd ReleaseLab
```

### 2. Configure environment variables

```bash
cp deploy/docker/.env.example deploy/docker/.env
# Edit .env and fill in your Stripe keys, JWT secret, etc.
```

### 3. Start infrastructure (PostgreSQL, Redis, MinIO)

```bash
docker compose -f deploy/docker/docker-compose.yml up -d postgres redis minio
```

MinIO console is available at `http://localhost:9001` (minioadmin / minioadmin).

### 4. Run database migrations

```bash
dotnet ef database update \
  --project src/Infrastructure/ReleaseLab.Infrastructure.Data \
  --startup-project src/Api/ReleaseLab.Api
```

### 5. Start the API

```bash
dotnet run --project src/Api/ReleaseLab.Api
# Swagger UI: https://localhost:5001/swagger
```

### 6. Start the Mastering Worker

```bash
dotnet run --project src/Workers/ReleaseLab.Worker.Mastering
```

### 7. Start the Frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

### Alternative: Run everything with Docker Compose

```bash
docker compose -f deploy/docker/docker-compose.yml up --build
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Create a new account |
| `POST` | `/api/v1/auth/login` | Obtain JWT + refresh token |
| `POST` | `/api/v1/auth/refresh` | Refresh an expired access token |
| `POST` | `/api/v1/auth/logout` | Revoke refresh token |

### User

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/me` | Get current user profile + credit balance |

### Uploads

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/uploads/init` | Get a pre-signed URL for direct-to-S3 upload |
| `POST` | `/api/v1/uploads/complete` | Confirm upload metadata |

### Jobs

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/jobs` | Create a mastering job (deducts credits) |
| `GET` | `/api/v1/jobs` | List jobs (paginated) |
| `GET` | `/api/v1/jobs/{id}` | Get job details |
| `GET` | `/api/v1/jobs/{id}/stream` | SSE real-time progress |
| `GET` | `/api/v1/jobs/{id}/download?kind=preview\|master` | Get pre-signed download URL |
| `POST` | `/api/v1/jobs/{id}/cancel` | Cancel a queued/processing job |

### Credits & Payments

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/credits/balance` | Get current credit balance |
| `POST` | `/api/v1/credits/purchase` | Create a Stripe checkout session |
| `POST` | `/api/v1/webhooks/stripe` | Stripe webhook receiver |

## Project Structure

```
ReleaseLab/
├── src/
│   ├── Api/
│   │   ├── ReleaseLab.Api/                          # Core REST API
│   │   │   ├── Controllers/                         # Auth, Jobs, Credits, Uploads
│   │   │   ├── Extensions/                          # Service registration
│   │   │   ├── Middleware/                           # Error handling, logging
│   │   │   └── Services/                            # Background services
│   │   ├── ReleaseLab.Upload/                       # Streaming upload service
│   │   └── ReleaseLab.Admin/                        # Admin API endpoints
│   │       └── Controllers/
│   │
│   ├── Core/
│   │   ├── ReleaseLab.Domain/                       # Entities, enums, value objects
│   │   │   ├── Entities/                            # User, Job, File, Payment, etc.
│   │   │   ├── Enums/                               # JobStatus, MasteringPreset, etc.
│   │   │   └── ValueObjects/
│   │   ├── ReleaseLab.Application/                  # Use cases (CQRS via MediatR)
│   │   │   ├── Auth/                                # Login, Register commands
│   │   │   ├── Credits/                             # Balance queries, purchase
│   │   │   ├── Jobs/                                # Create, list, cancel
│   │   │   ├── Uploads/                             # Init, complete
│   │   │   └── Interfaces/                          # Repository & service contracts
│   │   └── ReleaseLab.Contracts/                    # Queue message schemas
│   │       └── Messages/                            # MasteringJobMessage, etc.
│   │
│   ├── Infrastructure/
│   │   ├── ReleaseLab.Infrastructure.Data/          # EF Core DbContext, migrations
│   │   │   ├── Configurations/                      # Entity type configurations
│   │   │   ├── Migrations/
│   │   │   └── Seed/                                # Seed data
│   │   ├── ReleaseLab.Infrastructure.Storage/       # MinIO / S3 client
│   │   ├── ReleaseLab.Infrastructure.Queue/         # Redis queue producer/consumer
│   │   ├── ReleaseLab.Infrastructure.Payments/      # Stripe integration
│   │   ├── ReleaseLab.Infrastructure.Audio/         # FFmpeg wrapper, DSP chain
│   │   └── ReleaseLab.Infrastructure.Email/         # Email service
│   │
│   └── Workers/
│       └── ReleaseLab.Worker.Mastering/             # Background worker (FFmpeg DSP)
│
├── tests/
│   ├── ReleaseLab.UnitTests/                        # 83 unit tests (xUnit + Moq)
│   ├── ReleaseLab.IntegrationTests/                 # Integration tests
│   └── ReleaseLab.Worker.Tests/                     # Worker-specific tests
│
├── frontend/                                        # Next.js 14 application
│   └── src/
│       ├── app/                                     # App Router pages
│       │   ├── page.tsx                             # Landing page
│       │   ├── pricing/                             # Pricing page
│       │   ├── auth/login/                          # Login page
│       │   ├── auth/register/                       # Register page
│       │   ├── dashboard/                           # Dashboard (job list)
│       │   ├── dashboard/upload/                    # Upload page
│       │   ├── dashboard/credits/                   # Credits page
│       │   ├── dashboard/plan/                      # Plan management page
│       │   └── jobs/[id]/                           # Job detail + A/B comparison
│       ├── components/                              # Reusable UI components
│       │   ├── ui/                                  # Buttons, inputs, cards
│       │   ├── auth/                                # Auth forms
│       │   ├── dashboard/                           # Dashboard widgets
│       │   ├── jobs/                                # Job cards, waveform, player
│       │   └── upload/                              # Upload dropzone
│       └── lib/                                     # API client, stores, utilities
│
├── deploy/
│   ├── docker/
│   │   ├── docker-compose.yml                       # Development stack
│   │   ├── docker-compose.prod.yml                  # Production overrides
│   │   ├── Dockerfile.api
│   │   ├── Dockerfile.admin
│   │   ├── Dockerfile.upload
│   │   ├── Dockerfile.worker-mastering
│   │   ├── Dockerfile.frontend
│   │   └── .env.example
│   ├── monitoring/
│   │   └── prometheus.yml                           # Prometheus scrape config
│   ├── nginx/
│   │   ├── nginx.conf                               # Dev reverse proxy
│   │   └── nginx.prod.conf                          # Production config
│   └── scripts/
│       └── setup-dev.sh                             # Dev environment bootstrap
│
├── docs/                                            # Additional documentation
├── .github/workflows/
│   ├── ci.yml                                       # Build + test + Docker verify
│   └── docker.yml                                   # Docker image publish
│
└── ReleaseLab.sln                                   # .NET solution file
```

## Environment Variables

Create a `.env` file from the provided example:

```bash
cp deploy/docker/.env.example deploy/docker/.env
```

| Variable | Description | Example |
|---|---|---|
| `POSTGRES_USER` | PostgreSQL username | `releaselab` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `change-me-in-production` |
| `POSTGRES_CONNECTION` | Full connection string | `Host=postgres;Database=releaselab;...` |
| `REDIS_CONNECTION` | Redis host and port | `redis:6379` |
| `S3_ENDPOINT` | MinIO / S3 endpoint URL | `http://minio:9000` |
| `S3_ACCESS_KEY` | S3 access key | `minioadmin` |
| `S3_SECRET_KEY` | S3 secret key | `change-me-in-production` |
| `JWT_SECRET` | Secret for signing JWTs (min 64 chars) | `generate-a-64-char-random-string...` |
| `STRIPE_SECRET_KEY` | Stripe API secret key | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |
| `FRONTEND_URL` | Public URL of the frontend | `https://yourdomain.com` |

> **Warning:** Never commit real secrets to the repository. Use Docker secrets or a vault in production.

## Testing

The project uses **xUnit**, **Moq**, and **FluentAssertions**.

```bash
# Run all 83 unit tests
dotnet test ReleaseLab.sln

# Run only unit tests
dotnet test tests/ReleaseLab.UnitTests

# Run worker tests
dotnet test tests/ReleaseLab.Worker.Tests

# Run with detailed output
dotnet test ReleaseLab.sln --logger "console;verbosity=detailed"

# Generate test results (TRX format)
dotnet test ReleaseLab.sln --logger "trx;LogFileName=test-results.trx"
```

CI runs all tests automatically on every push and pull request to `main` via GitHub Actions.

## Deployment

### Docker Compose (recommended for MVP)

```bash
# Development
docker compose -f deploy/docker/docker-compose.yml up --build

# Production
docker compose \
  -f deploy/docker/docker-compose.yml \
  -f deploy/docker/docker-compose.prod.yml \
  up -d
```

### Production recommendations

| Concern | Recommendation |
|---|---|
| **Hosting** | Hetzner VPS (4-8 vCPU, 16 GB RAM) or equivalent |
| **Database** | Managed PostgreSQL (Neon, Supabase, or AWS RDS) for automated backups |
| **Object Storage** | Start with self-hosted MinIO, migrate to Backblaze B2 or Cloudflare R2 at scale |
| **Reverse Proxy** | Nginx with TLS (Let's Encrypt) -- configs provided in `deploy/nginx/` |
| **Monitoring** | Prometheus + Grafana -- scrape config in `deploy/monitoring/prometheus.yml` |
| **Scaling API** | Stateless; scale horizontally with `docker compose --scale api=N` or Kubernetes HPA |
| **Scaling Workers** | Scale based on queue depth; minimum 1 warm replica |
| **Upgrade Path** | Docker Compose -> Coolify/Dokku -> Kubernetes |

### Key metrics to monitor

- `queue_length` -- mastering queue backlog
- `job_duration_p95` -- 95th percentile processing time
- `worker_busy_ratio` -- worker utilization
- Job failure rate (alert if > 5%)
- Disk usage (alert at 80%)

## Roadmap

### Phase 2 -- AI-Powered Mastering (2-3 months)

- [ ] Python AI worker with PyTorch / Torchaudio
- [ ] Reference track matching (upload a reference, match its tonal profile)
- [ ] Advanced AI-driven presets
- [ ] Stem separation (optional, Demucs-based)

### Phase 3 -- Multi-Track & Collaboration (3-4 months)

- [ ] Multi-track upload and mixing
- [ ] Automated mixing pipeline
- [ ] Project sharing and collaboration between users
- [ ] Read replicas for database scaling
- [ ] Redis Sentinel / Cluster

### Phase 4 -- Distribution Integration (2 months)

- [ ] DistroKid / TuneCore API integration
- [ ] Release scheduling
- [ ] Metadata management (ISRC codes, artwork validation)

## License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  Built with .NET 8 and Next.js &mdash; <strong>ReleaseLab</strong>
</p>
