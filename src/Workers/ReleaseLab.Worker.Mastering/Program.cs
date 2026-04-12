using Microsoft.EntityFrameworkCore;
using Minio;
using ReleaseLab.Application.Interfaces;
using ReleaseLab.Infrastructure.Data;
using ReleaseLab.Infrastructure.Queue.Services;
using ReleaseLab.Infrastructure.Storage.Services;
using ReleaseLab.Worker.Mastering;
using StackExchange.Redis;

var builder = Host.CreateApplicationBuilder(args);

// Database
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")));
builder.Services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

// Redis
builder.Services.AddSingleton<IConnectionMultiplexer>(
    ConnectionMultiplexer.Connect(builder.Configuration["Redis:Connection"] ?? "localhost:6379"));

// MinIO
builder.Services.AddSingleton<IMinioClient>(sp =>
    new MinioClient()
        .WithEndpoint(builder.Configuration["S3:Endpoint"] ?? "localhost:9000")
        .WithCredentials(
            builder.Configuration["S3:AccessKey"] ?? "minioadmin",
            builder.Configuration["S3:SecretKey"] ?? "minioadmin")
        .WithSSL(false)
        .Build());

// Services
builder.Services.AddScoped<IQueueService, RedisQueueService>();
builder.Services.AddScoped<IStorageService, MinioStorageService>();

builder.Services.AddHostedService<MasteringWorker>();

var host = builder.Build();
host.Run();
