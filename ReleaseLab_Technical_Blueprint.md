# 🎛️ ReleaseLab — Production-Grade Technical Blueprint

> **"Studio-quality results without a studio."**
> Upload → Improve → Release

Bu döküman, ReleaseLab platformunun **mimari planını, servis yapısını, worker tasarımını, queue akışını, deployment stratejisini ve MVP → Scale roadmap'ini** kapsar. Hedef: hızlı MVP çıkışı + uzun vadede AI destekli, distribütör-entegre bir müzik üretim pipeline'ına evrilebilecek sağlam bir temel.

---

## 📑 İçindekiler

1. [Ürün Felsefesi & Mimari İlkeler](#1-ürün-felsefesi--mimari-ilkeler)
2. [High-Level Sistem Mimarisi](#2-high-level-sistem-mimarisi)
3. [Servis Katmanları (Detaylı)](#3-servis-katmanları-detaylı)
4. [.NET Solution Structure](#4-net-solution-structure)
5. [Worker Mimarisi (Faz 1 & Faz 2)](#5-worker-mimarisi-faz-1--faz-2)
6. [Queue Flow & Job Lifecycle](#6-queue-flow--job-lifecycle)
7. [Database Tasarımı](#7-database-tasarımı)
8. [Storage Stratejisi](#8-storage-stratejisi)
9. [API Tasarımı](#9-api-tasarımı)
10. [Güvenlik Katmanı](#10-güvenlik-katmanı)
11. [Performans & Scaling](#11-performans--scaling)
12. [Deployment (Docker)](#12-deployment-docker)
13. [MVP → Scale Roadmap](#13-mvp--scale-roadmap)
14. [Kritik Riskler & Mitigasyon](#14-kritik-riskler--mitigasyon)
15. [Monetization Implementation](#15-monetization-implementation)

---

## 1. Ürün Felsefesi & Mimari İlkeler

ReleaseLab **bir araç değil, bir sonuç platformudur**. Bu, mimari kararları da doğrudan etkiler:

| İlke | Anlamı | Mimari Yansıması |
|---|---|---|
| **Outcome > Feature** | Kullanıcı EQ ayarı istemez, "iyi ses" ister | Preset-driven DSP, parametre gizleme |
| **Async by default** | Upload anında bekleme olmaz | Queue + worker pattern her yerde |
| **Modular phases** | Faz 1 → Faz 4 breaking change olmadan ilerlemeli | Contract-based worker interface |
| **Pay-per-result** | Credit iş tamamlanınca düşer | Transactional job + credit flow |
| **Stateless services** | Horizontal scaling kolay olsun | State Redis + DB + S3'te, servisler stateless |

---

## 2. High-Level Sistem Mimarisi

```
┌───────────────┐         ┌─────────────────────────────────────────┐
│   Frontend    │  HTTPS  │          API Gateway / Reverse Proxy     │
│  (Next.js)    │◄───────►│          (Nginx / Traefik)               │
└───────────────┘         └──────────────┬──────────────────────────┘
                                         │
                ┌────────────────────────┼────────────────────────┐
                │                        │                        │
                ▼                        ▼                        ▼
      ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
      │  Auth API        │   │  Core API        │   │  Upload API      │
      │  (.NET)          │   │  (.NET)          │   │  (.NET, stream)  │
      └────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
               │                      │                      │
               └──────────┬───────────┴──────────┬───────────┘
                          │                      │
                          ▼                      ▼
                 ┌──────────────┐       ┌──────────────────┐
                 │  PostgreSQL  │       │   Redis          │
                 │  (primary)   │       │  (queue + cache) │
                 └──────────────┘       └────────┬─────────┘
                                                 │
                                   ┌─────────────┴─────────────┐
                                   │                           │
                                   ▼                           ▼
                          ┌──────────────────┐       ┌──────────────────┐
                          │ Mastering Worker │       │  AI Worker       │
                          │ (.NET + FFmpeg)  │       │  (Python, Faz 2) │
                          │    FAZ 1         │       │                  │
                          └────────┬─────────┘       └────────┬─────────┘
                                   │                          │
                                   └────────────┬─────────────┘
                                                ▼
                                    ┌──────────────────────┐
                                    │   S3 / MinIO         │
                                    │  (raw + processed)   │
                                    └──────────────────────┘

        ┌─────────────────┐       ┌─────────────────┐
        │ Stripe Webhook  │──────►│ Payment Service │
        └─────────────────┘       └─────────────────┘
```

---

## 3. Servis Katmanları (Detaylı)

Sistem **5 ana servis** + **1 worker pool** olarak tasarlanır. MVP'de monolith-modular başlayıp Faz 2+'da mikroservislere bölünebilir.

### 3.1 `ReleaseLab.Api` (Core API)
- **Sorumluluk:** Auth, user management, job CRUD, credit, payment
- **Tech:** ASP.NET Core 8, EF Core, MediatR (CQRS), FluentValidation
- **Stateless:** Evet — Redis + DB'ye yaslanır

### 3.2 `ReleaseLab.Upload` (Upload Service)
- **Neden ayrı?** Büyük dosya upload'u Core API'yi bloke etmesin diye
- **Tech:** ASP.NET Core minimal API, chunked/streamed upload, TUS protokolü (opsiyonel)
- **Flow:** Upload → S3'e direct stream → Core API'ye metadata push

### 3.3 `ReleaseLab.Worker.Mastering` (Faz 1 Worker)
- **Tech:** .NET Worker Service (BackgroundService)
- **DSP:** FFmpeg + NAudio veya CSCore
- **Pattern:** Redis'ten BRPOP → process → result upload → status update

### 3.4 `ReleaseLab.Worker.AI` (Faz 2 Worker)
- **Tech:** Python 3.11 + FastAPI (health/metrics) + Celery veya custom Redis consumer
- **ML:** PyTorch, Torchaudio, Demucs, Librosa
- **Pattern:** Aynı queue interface'ini implement eder — Core API worker tipinden haberdar değildir

### 3.5 `ReleaseLab.Admin` (Admin API)
- **Sorumluluk:** User yönetimi, job monitoring, credit manuel ekleme, refund
- **Tech:** ASP.NET Core + ayrı JWT scope

### 3.6 **Shared Libraries**
- `ReleaseLab.Domain` — entities, value objects, domain events
- `ReleaseLab.Application` — use cases, DTOs, interfaces
- `ReleaseLab.Infrastructure` — EF, S3, Redis, Stripe implementasyonları
- `ReleaseLab.Contracts` — queue message schemas (worker'lar dahil herkes referans verir)

---

## 4. .NET Solution Structure

```
ReleaseLab.sln
│
├── src/
│   ├── Api/
│   │   ├── ReleaseLab.Api/                  # Core REST API
│   │   ├── ReleaseLab.Upload/               # Streaming upload service
│   │   └── ReleaseLab.Admin/                # Admin endpoints
│   │
│   ├── Workers/
│   │   ├── ReleaseLab.Worker.Mastering/     # Faz 1 — FFmpeg/DSP
│   │   └── ReleaseLab.Worker.AI/            # Faz 2 — Python (ayrı repo olabilir)
│   │
│   ├── Core/
│   │   ├── ReleaseLab.Domain/               # Entities, events, enums
│   │   ├── ReleaseLab.Application/          # Use cases (CQRS), interfaces
│   │   └── ReleaseLab.Contracts/            # Queue messages, shared DTOs
│   │
│   └── Infrastructure/
│       ├── ReleaseLab.Infrastructure.Data/       # EF Core, migrations
│       ├── ReleaseLab.Infrastructure.Storage/    # S3/MinIO client
│       ├── ReleaseLab.Infrastructure.Queue/      # Redis consumer/producer
│       ├── ReleaseLab.Infrastructure.Payments/   # Stripe integration
│       └── ReleaseLab.Infrastructure.Audio/      # FFmpeg wrapper, DSP chain
│
├── tests/
│   ├── ReleaseLab.UnitTests/
│   ├── ReleaseLab.IntegrationTests/
│   └── ReleaseLab.Worker.Tests/
│
├── deploy/
│   ├── docker/
│   │   ├── docker-compose.yml
│   │   ├── docker-compose.prod.yml
│   │   └── Dockerfile.*
│   ├── nginx/
│   └── scripts/
│
└── docs/
    ├── architecture.md
    ├── api.md
    └── runbook.md
```

### Önerilen NuGet paketleri

| Katman | Paketler |
|---|---|
| API | `MediatR`, `FluentValidation`, `Swashbuckle`, `Serilog.AspNetCore`, `Asp.Versioning` |
| Auth | `Microsoft.AspNetCore.Authentication.JwtBearer`, `BCrypt.Net-Next` |
| Data | `Microsoft.EntityFrameworkCore.Design`, `Npgsql.EntityFrameworkCore.PostgreSQL` |
| Queue | `StackExchange.Redis` |
| Storage | `AWSSDK.S3` (MinIO uyumlu) veya `Minio` |
| Payments | `Stripe.net` |
| Audio | `Xabe.FFmpeg`, `NAudio` |
| Resilience | `Polly` |
| Observability | `OpenTelemetry.*`, `Serilog.Sinks.Seq` |

---

## 5. Worker Mimarisi (Faz 1 & Faz 2)

### 5.1 Worker Interface (Contract)

Worker'lar **aynı queue mesaj şemasını** tüketir. Bu sayede Faz 2'de Python worker'a geçerken API'de değişiklik gerekmez.

```csharp
// ReleaseLab.Contracts/Messages/MasteringJobMessage.cs
public record MasteringJobMessage
{
    public Guid JobId { get; init; }
    public Guid UserId { get; init; }
    public string InputS3Key { get; init; }
    public string OutputBucket { get; init; }
    public MasteringPreset Preset { get; init; }   // Warm, Bright, Loud, Balanced...
    public AudioQuality Quality { get; init; }     // Preview | HiRes
    public int AttemptCount { get; init; }
    public DateTime EnqueuedAt { get; init; }
}
```

### 5.2 Faz 1 Worker (FFmpeg Chain)

Rule-based mastering pipeline. Her preset bir FFmpeg filter graph'ına maplenir.

```
Input WAV
   │
   ▼
[HPF 30Hz] ─► [EQ preset] ─► [Compressor] ─► [Stereo Widener]
                                                     │
                                                     ▼
                                            [LUFS Normalize -14]
                                                     │
                                                     ▼
                                              [Peak Limiter -1dB]
                                                     │
                                                     ▼
                                            Output (WAV + MP3 320)
```

**Örnek FFmpeg komutu (Loud preset):**
```bash
ffmpeg -i input.wav \
  -af "highpass=f=30, \
       equalizer=f=80:width_type=o:width=2:g=2, \
       equalizer=f=8000:width_type=o:width=2:g=1.5, \
       acompressor=threshold=-18dB:ratio=3:attack=10:release=200, \
       loudnorm=I=-9:TP=-1:LRA=7, \
       alimiter=limit=0.95" \
  -ar 44100 -b:a 320k output.mp3
```

### 5.3 Faz 2 Worker (Python AI)

```python
# worker.py (sadeleştirilmiş)
import redis, json
from release_lab.inference import tonal_match, loudness_optimize
from release_lab.storage import download_s3, upload_s3

r = redis.Redis(host="redis", port=6379)

while True:
    _, raw = r.brpop("queue:mastering:ai")
    msg = json.loads(raw)

    local = download_s3(msg["InputS3Key"])
    processed = tonal_match(local, reference=msg["Preset"])
    processed = loudness_optimize(processed, target_lufs=-14)
    out_key = upload_s3(processed, bucket=msg["OutputBucket"])

    r.publish("events:job:completed", json.dumps({
        "JobId": msg["JobId"],
        "OutputS3Key": out_key
    }))
```

### 5.4 Worker Reliability

| Risk | Çözüm |
|---|---|
| Crash during processing | Visibility timeout + retry queue (`queue:mastering:retry`) |
| Poison message | Max 3 retry → `queue:mastering:dead` |
| Duplicate processing | Idempotency: `JobId` üzerinden DB check ("already Completed? skip") |
| Long jobs | Heartbeat: worker her 15s `job:heartbeat:{id}` key'ini refresh eder |
| OOM on large files | Pre-flight duration/size check + streaming decode |

---

## 6. Queue Flow & Job Lifecycle

### 6.1 Redis Key Şeması

```
queue:mastering:pending          → LIST  (BRPOP)
queue:mastering:processing       → HASH  { jobId: workerId }
queue:mastering:retry            → ZSET  (score = retry_at_unix)
queue:mastering:dead             → LIST
job:heartbeat:{jobId}            → STRING TTL 30s
events:job:{jobId}:progress      → PUB/SUB  (SSE için)
rate_limit:user:{userId}:uploads → STRING TTL 3600s
```

### 6.2 Job Lifecycle

```
  [Created] ─► [Queued] ─► [Processing] ─► [Completed]
      │           │            │
      │           │            ├─► [Failed (retryable)] ──► [Queued]  (retry++)
      │           │            │
      │           │            └─► [Failed (permanent)] ──► [Dead]
      │           │
      │           └─► [Cancelled]  (user/admin)
      │
      └─► [Rejected]  (validation fail, insufficient credits)
```

### 6.3 Progress Streaming

Kullanıcı real-time progress görsün diye **Server-Sent Events (SSE)** kullanılır:

```
GET /api/jobs/{id}/stream
   → Core API, Redis PUB/SUB'a subscribe olur
   → Worker yayınladıkça client'a push eder
```

Alternatif: SignalR (WebSocket). MVP için SSE yeterli ve daha ucuz.

---

## 7. Database Tasarımı

**PostgreSQL tavsiye edilir** (JSONB, partial index, cheap hosting).

### 7.1 Ana Tablolar

```sql
-- users
id              UUID PK
email           VARCHAR(255) UNIQUE NOT NULL
password_hash   TEXT NOT NULL
display_name    VARCHAR(100)
plan            VARCHAR(20) DEFAULT 'free'   -- free | pro | studio
email_verified  BOOLEAN DEFAULT FALSE
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ

-- files
id              UUID PK
user_id         UUID FK → users(id)
s3_key          TEXT NOT NULL
kind            VARCHAR(20)                  -- raw | processed | preview
format          VARCHAR(10)                  -- wav | mp3 | flac
duration_sec    INT
size_bytes      BIGINT
checksum_sha256 CHAR(64)
created_at      TIMESTAMPTZ
INDEX (user_id, kind)

-- jobs
id              UUID PK
user_id         UUID FK → users(id)
input_file_id   UUID FK → files(id)
output_file_id  UUID FK → files(id) NULL
status          VARCHAR(20)                  -- queued|processing|completed|failed|cancelled
worker_type     VARCHAR(20)                  -- mastering_v1 | ai_v1 | ai_v2
preset          VARCHAR(30)
quality         VARCHAR(10)                  -- preview | hires
progress        SMALLINT DEFAULT 0           -- 0-100
error_code      VARCHAR(50)
error_message   TEXT
attempt_count   SMALLINT DEFAULT 0
credits_cost    INT
started_at      TIMESTAMPTZ
finished_at     TIMESTAMPTZ
created_at      TIMESTAMPTZ
INDEX (user_id, created_at DESC)
INDEX (status) WHERE status IN ('queued','processing')

-- credits_ledger  (double-entry style; tek tablo)
id              BIGSERIAL PK
user_id         UUID FK
delta           INT                           -- + satın alma, - kullanım
reason          VARCHAR(30)                   -- purchase | job | refund | bonus
ref_job_id      UUID NULL
ref_payment_id  UUID NULL
balance_after   INT                           -- denormalize, hızlı okuma için
created_at      TIMESTAMPTZ
INDEX (user_id, created_at DESC)

-- payments
id              UUID PK
user_id         UUID FK
stripe_session  VARCHAR(200)
stripe_pi       VARCHAR(200)
amount_cents    INT
currency        CHAR(3)
status          VARCHAR(20)                   -- pending|succeeded|failed|refunded
credits_granted INT
created_at      TIMESTAMPTZ
INDEX (user_id), INDEX (stripe_pi)

-- refresh_tokens
id              UUID PK
user_id         UUID FK
token_hash      CHAR(64)
expires_at      TIMESTAMPTZ
revoked_at      TIMESTAMPTZ NULL
```

### 7.2 Credit Hesaplama İlkesi
- **Tek source of truth:** `credits_ledger`. User'ın bakiyesi = `SUM(delta)`.
- Hızlı okuma için `users.credit_balance` **cache column** olabilir, ama otorite ledger'dır.
- Credit düşümü ve job oluşturma **aynı transaction'da** olmalı.

---

## 8. Storage Stratejisi

### 8.1 Bucket Yapısı (MinIO / S3)

```
releaselab-raw/
  {userId}/{yyyy}/{mm}/{jobId}.wav

releaselab-processed/
  {userId}/{jobId}/preview.mp3    (128 kbps, watermarked opsiyonel)
  {userId}/{jobId}/master.wav     (paid unlock)
  {userId}/{jobId}/master.mp3     (320 kbps)

releaselab-temp/
  (lifecycle: 24h sonra otomatik sil)
```

### 8.2 Erişim Kontrolü
- **Tüm bucket'lar private.**
- İndirme için **pre-signed URL** (5-15 dk TTL).
- Preview free, master paid — paid kontrolü API tarafında, URL sadece ödeme sonrası üretilir.

### 8.3 Lifecycle Policies
- `raw`: 30 gün sonra Glacier / arşiv
- `temp`: 24 saat sonra sil
- `processed`: sınırsız (plan bazlı kural eklenebilir)

---

## 9. API Tasarımı

### 9.1 Endpoint Haritası (v1)

| Method | Path | Açıklama |
|---|---|---|
| POST | `/api/v1/auth/register` | Kayıt |
| POST | `/api/v1/auth/login` | JWT + refresh |
| POST | `/api/v1/auth/refresh` | Token yenile |
| POST | `/api/v1/auth/logout` | Refresh revoke |
| GET  | `/api/v1/me` | Profil + credit balance |
| POST | `/api/v1/uploads/init` | Pre-signed URL (direct-to-S3) |
| POST | `/api/v1/uploads/complete` | Metadata confirm |
| POST | `/api/v1/jobs` | Job oluştur (credit düşer) |
| GET  | `/api/v1/jobs` | Liste (paginated) |
| GET  | `/api/v1/jobs/{id}` | Detay |
| GET  | `/api/v1/jobs/{id}/stream` | SSE progress |
| GET  | `/api/v1/jobs/{id}/download?kind=preview\|master` | Pre-signed URL |
| POST | `/api/v1/jobs/{id}/cancel` | İptal |
| GET  | `/api/v1/credits/balance` | Güncel bakiye |
| POST | `/api/v1/credits/purchase` | Stripe checkout session |
| POST | `/api/v1/webhooks/stripe` | Stripe webhook |

### 9.2 Upload Flow (Direct-to-S3)

Büyük dosyaları API üzerinden geçirmek **anti-pattern**. Önerilen:

```
1. Client  → POST /uploads/init { filename, size, contentType }
2. API     → pre-signed PUT URL + fileId
3. Client  → PUT URL (S3'e direct, multipart)
4. Client  → POST /uploads/complete { fileId, etag, checksum }
5. API     → DB'ye files row yazar, user'a fileId döner
6. Client  → POST /jobs { fileId, preset, quality }
```

Avantaj: API bandwidth'i sıfır, ölçeklenebilir, TUS/multipart destekli.

---

## 10. Güvenlik Katmanı

| Konu | Uygulama |
|---|---|
| **Auth** | JWT access token (15dk) + refresh token (30gün, DB'de hash'li) |
| **Password** | BCrypt (work factor 12) |
| **Rate limiting** | IP + user bazlı (`AspNetCoreRateLimit` veya `FixedWindowRateLimiter`) — `/auth/*` ve `/uploads/*` için sıkı |
| **File validation** | Magic-number kontrolü (content-type güvenilmez), max 50MB free / 500MB pro |
| **Virus scan** | MVP sonrası: ClamAV sidecar container |
| **Signed URLs** | Tüm dosya erişimi, kısa TTL |
| **CORS** | Whitelist only |
| **Secrets** | Docker secrets / env; asla repo'da |
| **SQL injection** | EF Core parameterized by default — raw SQL yazmayın |
| **OWASP headers** | `X-Content-Type-Options`, `CSP`, `HSTS` (Nginx layer) |
| **Stripe webhook** | İmza doğrulama + idempotency key |
| **Audit log** | Admin actions + credit changes ayrı tabloya |

---

## 11. Performans & Scaling

### 11.1 Bottleneck Haritası

| Katman | Bottleneck | Çözüm |
|---|---|---|
| Upload | Network | Direct-to-S3 + multipart |
| API | DB connection | PgBouncer / built-in pooling |
| Queue | Single Redis | Redis Cluster veya RabbitMQ Faz 3+ |
| Worker | CPU (FFmpeg) / GPU (AI) | Horizontal scale + node affinity |
| Download | Bandwidth | CDN (Cloudflare) önünde signed URL |

### 11.2 Scaling Stratejisi
- **API:** Stateless → `docker-compose --scale api=3` veya K8s HPA
- **Worker:** Queue derinliğine göre autoscale (`QUEUE_LEN / THRESHOLD`)
- **DB:** Read replica Faz 3'te; MVP'de tek instance yeterli
- **Redis:** MVP tek instance; Faz 3'te sentinel veya cluster

### 11.3 Observability (Day 1'den)
- **Logs:** Serilog → Seq (dev) / Loki (prod)
- **Metrics:** Prometheus + Grafana — `queue_length`, `job_duration_p95`, `worker_busy_ratio`
- **Tracing:** OpenTelemetry → Tempo/Jaeger
- **Alerts:** Queue backlog > 100, job failure rate > 5%, disk > 80%

---

## 12. Deployment (Docker)

### 12.1 `docker-compose.yml` (Development)

```yaml
version: "3.9"

services:
  api:
    build: { context: ., dockerfile: deploy/docker/Dockerfile.api }
    environment:
      - ConnectionStrings__Postgres=Host=postgres;Database=releaselab;Username=rl;Password=rl
      - Redis__Connection=redis:6379
      - S3__Endpoint=http://minio:9000
      - S3__AccessKey=minioadmin
      - S3__SecretKey=minioadmin
    depends_on: [postgres, redis, minio]
    ports: ["5000:8080"]

  upload:
    build: { context: ., dockerfile: deploy/docker/Dockerfile.upload }
    ports: ["5001:8080"]

  worker-mastering:
    build: { context: ., dockerfile: deploy/docker/Dockerfile.worker-mastering }
    deploy: { replicas: 2 }
    depends_on: [redis, minio]

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=releaselab
      - POSTGRES_USER=rl
      - POSTGRES_PASSWORD=rl
    volumes: ["pgdata:/var/lib/postgresql/data"]
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes"]
    volumes: ["redisdata:/data"]

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    ports: ["9000:9000", "9001:9001"]
    volumes: ["minio:/data"]

  nginx:
    image: nginx:alpine
    volumes: ["./deploy/nginx/nginx.conf:/etc/nginx/nginx.conf:ro"]
    ports: ["80:80", "443:443"]
    depends_on: [api, upload]

volumes: { pgdata: {}, redisdata: {}, minio: {} }
```

### 12.2 Dockerfile (Worker örneği)

```dockerfile
# deploy/docker/Dockerfile.worker-mastering
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish src/Workers/ReleaseLab.Worker.Mastering -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:8.0
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app .
ENTRYPOINT ["dotnet", "ReleaseLab.Worker.Mastering.dll"]
```

### 12.3 Production Önerileri
- **Hosting (MVP):** Hetzner VPS CX32/CPX41 — 4-8 vCPU, 16GB RAM, NVMe → Docker Compose yeter
- **Upgrade path:** Coolify veya Dokku (self-hosted PaaS) → sonra K8s
- **DB:** Managed (Neon, Supabase, AWS RDS) — backup + PITR kendin uğraşma
- **S3:** MinIO (self-host) başla, yük artınca Backblaze B2 veya Cloudflare R2 (ucuz egress)

---

## 13. MVP → Scale Roadmap

### 🟢 **Sprint 0 (1 hafta) — Foundation**
- Solution setup, CI/CD (GitHub Actions), Docker compose dev
- Auth (register/login/refresh), `/me`
- DB migrations, seed

### 🟢 **Sprint 1-2 (2 hafta) — Upload + Storage**
- Direct-to-S3 presigned URL flow
- File validation, metadata DB
- MinIO local

### 🟢 **Sprint 3-4 (2 hafta) — Job + Mastering Worker (Faz 1)**
- Job CRUD, Redis queue
- FFmpeg chain — 3 preset (Warm/Bright/Loud)
- SSE progress streaming
- Idempotency + retry

### 🟢 **Sprint 5 (1 hafta) — Credits + Stripe**
- Ledger, purchase flow, webhook
- Free tier: 1 master / gün

### 🟢 **Sprint 6 (1 hafta) — Polish + Launch**
- A/B preview UI contract (frontend'le)
- Download gating (preview free / master paid)
- Observability basics
- Landing + docs

**Toplam MVP: ~7 hafta tek geliştirici, aggressive tempo.**

### 🟡 **Faz 2 (2-3 ay)**
- Python AI worker
- Reference track matching
- Advanced presets
- Stem separation (opsiyonel)

### 🔴 **Faz 3 (3-4 ay)**
- Multi-track upload
- Auto mixing
- Collaboration (project sharing)

### 🔵 **Faz 4 (2 ay)**
- DistroKid / TuneCore API entegrasyonu
- Release scheduling
- Metadata (ISRC, artwork validation)

---

## 14. Kritik Riskler & Mitigasyon

| # | Risk | Etki | Mitigasyon |
|---|---|---|---|
| R1 | **FFmpeg mastering "yeterince iyi" değil** | Churn yüksek olur | Günlerce A/B test yap. Gerekirse preset'leri bir mastering engineer ile tune et. Faz 2'yi öne al. |
| R2 | **Büyük dosya upload'ları sunucuyu boğar** | Downtime | Direct-to-S3 zorunlu. API üzerinden proxy'leme **yasak**. |
| R3 | **Worker crash → credit düşmüş ama job yarım** | Para kaybı, destek yükü | Credit düşümü `Completed`'da; `Processing`'de **hold** olarak tut. Fail → release. |
| R4 | **Stripe webhook kaçırılır** | Ödeme girdi, credit gitmedi | Idempotency key + webhook replay endpoint (admin) + Stripe retry default zaten var |
| R5 | **Kullanıcı preview'ı "master kalite" sanar** | Refund | Preview'a **audible watermark** (düşük dB'de branding tone her 30s) |
| R6 | **Copyright'lı şarkı yükleme** | Yasal | ToS + takedown flow, `acoustid` fingerprint Faz 3 |
| R7 | **Redis down → tüm sistem durur** | Critical | Redis AOF persistence + daily snapshot + sentinel Faz 3 |
| R8 | **Disk dolar (temp files)** | Yeni upload fail | Lifecycle policy + cron cleanup + alert %80'de |
| R9 | **Python worker .NET ekosisteminden ayrık** | Karmaşıklık | Sadece `Contracts` schema paylaşılır. JSON schema + versioning. |
| R10 | **AI model inference maliyeti** | Margin erir | GPU'yu on-demand (RunPod/Vast) kullan, baseline CPU worker |
| R11 | **Cold start (worker boş dururken job gelir)** | UX | Warm pool: min 1 replica her zaman açık |
| R12 | **Kullanıcı "neden bu kadar sürdü" diye sorar** | Support yükü | Progress SSE + tahmini süre (`estimated_duration_sec`) |

---

## 15. Monetization Implementation

### 15.1 Plan Matrisi

| | Free | Pro ($9/mo) | Studio ($29/mo) |
|---|---|---|---|
| Aylık master | 1 | 20 | 100 |
| Preview kalite | 128kbps + watermark | Clean | Clean |
| Master format | — | WAV + MP3 320 | WAV + MP3 320 + FLAC |
| Dosya boyutu | 50MB | 200MB | 500MB |
| Öncelikli kuyruk | ✗ | ✓ | ✓✓ |
| AI presets (Faz 2) | ✗ | ✓ | ✓ |
| Reference matching | ✗ | ✗ | ✓ |

### 15.2 Credit Paketleri (Pay-per-use)
- 5 credit — $5
- 15 credit — $12 (%20 indirim)
- 50 credit — $35 (%30 indirim)

1 credit = 1 hi-res master export.

### 15.3 Queue Priority
Redis'te **üç ayrı queue**:
```
queue:mastering:priority-high    (Studio)
queue:mastering:priority-normal  (Pro + credit buyers)
queue:mastering:priority-low     (Free)
```
Worker BRPOP sırası: high → normal → low. Basit, efektif.

---

## 🎯 Özet: İlk Gün Yapılacaklar Listesi

1. `dotnet new sln -n ReleaseLab`
2. Yukarıdaki folder structure'ı kur
3. `docker-compose up` ile postgres + redis + minio ayağa kalksın
4. EF migration: users, files, jobs, credits_ledger
5. Auth endpoint'leri (register/login)
6. Upload init endpoint — presigned URL dön
7. Job creation endpoint — Redis LPUSH
8. Worker skeleton — BRPOP + "process" (mock) + status update
9. SSE progress endpoint
10. Tek bir FFmpeg preset gerçek çalışsın → **end-to-end ilk yeşil çizgi**

Bu 10 adım tamamlandığında elinde **çalışan bir omurga** olur. Gerisi iterasyon.

---

**Bu blueprint bir başlangıç noktası; implementasyon sırasında her faz sonu revize edilmeli.** Özellikle Faz 1 sonrası gerçek kullanıcı feedback'i mimariyi yönlendirmeli — şu an yazılı olanlar "best guess", gerçek veri gelince güncelleme kaçınılmaz.
