using Microsoft.EntityFrameworkCore;
using Minio;
using ReleaseLab.Application.Interfaces;
using ReleaseLab.Infrastructure.Data;
using ReleaseLab.Infrastructure.Queue.Services;
using ReleaseLab.Infrastructure.Storage.Services;
using ReleaseLab.Worker.Mastering;
using Serilog;
using StackExchange.Redis;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .Enrich.FromLogContext()
    .CreateBootstrapLogger();

try
{
    var builder = Host.CreateApplicationBuilder(args);

    builder.Services.AddSerilog((_, lc) => lc
        .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
        .Enrich.FromLogContext()
        .Enrich.WithProperty("Application", "ReleaseLab.Worker.Mastering"));

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

    // Workers
    builder.Services.AddHostedService<MasteringWorker>();
    builder.Services.AddHostedService<HeartbeatService>();
    builder.Services.AddHostedService<DeadLetterProcessor>();

    var host = builder.Build();
    Log.Information("Mastering worker starting...");
    host.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Worker terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
