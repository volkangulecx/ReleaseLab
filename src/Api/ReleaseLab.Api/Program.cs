using System.Text;
using System.Threading.RateLimiting;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Minio;
using ReleaseLab.Api.Extensions;
using ReleaseLab.Api.Middleware;
using ReleaseLab.Api.Services;
using ReleaseLab.Infrastructure.Audio.Services;
using ReleaseLab.Infrastructure.Data.Seed;
using ReleaseLab.Infrastructure.Email.Services;
using ReleaseLab.Application.Interfaces;
using ReleaseLab.Infrastructure.Data;
using ReleaseLab.Infrastructure.Payments.Services;
using ReleaseLab.Infrastructure.Queue.Services;
using ReleaseLab.Infrastructure.Storage.Services;
using Serilog;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// Serilog
builder.Services.AddSerilog(lc => lc
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .Enrich.FromLogContext()
    .Enrich.WithProperty("Application", "ReleaseLab.Api"));

    // ── Database ──
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")));
    builder.Services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

    // ── Redis ──
    var redisConnection = builder.Configuration["Redis:Connection"] ?? "localhost:6379";
    builder.Services.AddSingleton<IConnectionMultiplexer>(sp =>
        ConnectionMultiplexer.Connect($"{redisConnection},abortConnect=false"));

    // ── MinIO / S3 ──
    builder.Services.AddSingleton<IMinioClient>(sp =>
        new MinioClient()
            .WithEndpoint(builder.Configuration["S3:Endpoint"] ?? "localhost:9000")
            .WithCredentials(
                builder.Configuration["S3:AccessKey"] ?? "minioadmin",
                builder.Configuration["S3:SecretKey"] ?? "minioadmin")
            .WithSSL(false)
            .Build());

    // ── Application Services ──
    builder.Services.AddScoped<IQueueService, RedisQueueService>();
    builder.Services.AddScoped<IStorageService, MinioStorageService>();
    builder.Services.AddScoped<IPaymentService, StripePaymentService>();
    builder.Services.AddScoped<ISubscriptionService, ReleaseLab.Infrastructure.Payments.Services.StripeSubscriptionService>();
    builder.Services.AddSingleton<IJwtService, JwtService>();
    // Email: SMTP in production, console logger in development
    if (builder.Environment.IsProduction() && !string.IsNullOrEmpty(builder.Configuration["Smtp:Host"]))
        builder.Services.AddScoped<IEmailService, ReleaseLab.Infrastructure.Email.Services.SmtpEmailService>();
    else
        builder.Services.AddScoped<IEmailService, ConsoleEmailService>();
    builder.Services.AddSingleton<IAudioAnalysisService, FFmpegAnalysisService>();

    // ── Auth ──
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.MapInboundClaims = false;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = builder.Configuration["Jwt:Issuer"],
                ValidAudience = builder.Configuration["Jwt:Audience"],
                IssuerSigningKey = new SymmetricSecurityKey(
                    Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Secret"]!)),
                NameClaimType = "sub"
            };
        });
    builder.Services.AddAuthorization(options =>
    {
        options.AddPolicy("AdminOnly", policy => policy.RequireClaim("role", "admin"));
    });

    // ── SignalR ──
    builder.Services.AddSignalR();
    builder.Services.AddSingleton<INotificationService, ReleaseLab.Api.Services.SignalRNotificationService>();

    // ── Scoped Services ──
    builder.Services.AddScoped<ReleaseLab.Api.Services.MixdownService>();

    // ── Background Services ──
    builder.Services.AddHostedService<ReleaseLab.Api.Services.CleanupService>();
    builder.Services.AddHostedService<ReleaseLab.Api.Services.RedisSignalRBridge>();

    // ── Rate Limiting ──
    builder.Services.AddRateLimiter(options =>
    {
        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

        options.AddFixedWindowLimiter("auth", opt =>
        {
            opt.PermitLimit = 10;
            opt.Window = TimeSpan.FromMinutes(1);
            opt.QueueLimit = 0;
        });

        options.AddFixedWindowLimiter("upload", opt =>
        {
            opt.PermitLimit = 20;
            opt.Window = TimeSpan.FromMinutes(1);
            opt.QueueLimit = 0;
        });

        options.AddFixedWindowLimiter("general", opt =>
        {
            opt.PermitLimit = 100;
            opt.Window = TimeSpan.FromMinutes(1);
            opt.QueueLimit = 0;
        });
    });

    // ── Validation ──
    builder.Services.AddValidatorsFromAssemblyContaining<ReleaseLab.Api.Validators.RegisterRequestValidator>();

    // ── Health Checks ──
    builder.Services.AddHealthChecks()
        .AddNpgSql(builder.Configuration.GetConnectionString("Postgres")!, name: "postgres")
        .AddRedis(redisConnection, name: "redis");

    // ── Swagger ──
    builder.Services.AddControllers();
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(c =>
    {
        c.SwaggerDoc("v1", new OpenApiInfo
        {
            Title = "ReleaseLab API",
            Version = "v1",
            Description = "Music mastering platform API"
        });

        c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
        {
            Description = "JWT Authorization header. Example: \"Bearer {token}\"",
            Name = "Authorization",
            In = ParameterLocation.Header,
            Type = SecuritySchemeType.ApiKey,
            Scheme = "Bearer"
        });

        c.AddSecurityRequirement(new OpenApiSecurityRequirement
        {
            {
                new OpenApiSecurityScheme
                {
                    Reference = new OpenApiReference
                    {
                        Type = ReferenceType.SecurityScheme,
                        Id = "Bearer"
                    }
                },
                Array.Empty<string>()
            }
        });
    });

    // ── Observability ──
    builder.Services.AddObservability(builder.Configuration);

    // ── CORS ──
    builder.Services.AddCors(options =>
    {
        options.AddDefaultPolicy(policy =>
            policy
                .WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? new[] { "http://localhost:3000" })
                .AllowAnyMethod()
                .AllowAnyHeader()
                .AllowCredentials());
    });

    // ── Response Compression ──
    builder.Services.AddResponseCompression(options =>
    {
        options.EnableForHttps = true;
    });

    var app = builder.Build();

    // ── Middleware Pipeline ──
    app.UseResponseCompression();
    app.UseMiddleware<SecurityHeadersMiddleware>();
    app.UseMiddleware<CorrelationIdMiddleware>();
    app.UseMiddleware<ExceptionHandlingMiddleware>();
    app.UseMiddleware<RequestLoggingMiddleware>();

    // Auto-migrate and seed in development
    if (app.Environment.IsDevelopment())
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
        await DbSeeder.SeedAsync(db, scope.ServiceProvider.GetRequiredService<ILogger<Program>>());

        app.UseSwagger();
        app.UseSwaggerUI(c =>
        {
            c.SwaggerEndpoint("/swagger/v1/swagger.json", "ReleaseLab API v1");
            c.RoutePrefix = "swagger";
        });
    }

    app.UseCors();
    app.UseRateLimiter();
    app.UseAuthentication();
    app.UseAuthorization();

    app.MapControllers();
    app.MapHub<ReleaseLab.Api.Hubs.JobHub>("/hubs/jobs");

    // Observability
    app.MapHealthChecks("/health");
    app.MapPrometheusScrapingEndpoint("/metrics");
    app.MapGet("/", () => Results.Ok(new
    {
        name = "ReleaseLab API",
        version = "1.0.0",
        status = "running"
    }));

app.Run();

public partial class Program { }
