using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Minio;
using ReleaseLab.Api.Services;
using ReleaseLab.Application.Interfaces;
using ReleaseLab.Infrastructure.Data;
using ReleaseLab.Infrastructure.Queue.Services;
using ReleaseLab.Infrastructure.Storage.Services;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// Database
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")));
builder.Services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

// Redis
builder.Services.AddSingleton<IConnectionMultiplexer>(
    ConnectionMultiplexer.Connect(builder.Configuration["Redis:Connection"] ?? "localhost:6379"));

// MinIO / S3
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
builder.Services.AddSingleton<IJwtService, JwtService>();

// Auth
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Secret"]!))
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

var app = builder.Build();

// Auto-migrate in development
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();

    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.Run();
