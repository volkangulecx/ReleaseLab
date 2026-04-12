using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Minio;
using ReleaseLab.Application.Interfaces;
using ReleaseLab.Infrastructure.Storage.Services;

var builder = WebApplication.CreateBuilder(args);

// MinIO
builder.Services.AddSingleton<IMinioClient>(sp =>
    new MinioClient()
        .WithEndpoint(builder.Configuration["S3:Endpoint"] ?? "localhost:9000")
        .WithCredentials(
            builder.Configuration["S3:AccessKey"] ?? "minioadmin",
            builder.Configuration["S3:SecretKey"] ?? "minioadmin")
        .WithSSL(false)
        .Build());

builder.Services.AddScoped<IStorageService, MinioStorageService>();

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

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

// Direct chunked upload to S3 via streaming
app.MapPost("/api/v1/upload/stream", async (HttpContext ctx, IStorageService storage) =>
{
    if (!ctx.User.Identity?.IsAuthenticated ?? true)
        return Results.Unauthorized();

    var userId = ctx.User.FindFirst("sub")?.Value;
    if (userId is null) return Results.Unauthorized();

    var contentType = ctx.Request.ContentType ?? "application/octet-stream";
    var fileName = ctx.Request.Headers["X-File-Name"].FirstOrDefault() ?? "upload.bin";

    var fileId = Guid.NewGuid();
    var now = DateTime.UtcNow;
    var s3Key = $"{userId}/{now:yyyy}/{now:MM}/{fileId}{Path.GetExtension(fileName)}";

    // Stream directly to MinIO
    var minio = ctx.RequestServices.GetRequiredService<IMinioClient>();

    // Ensure bucket exists
    const string bucket = "releaselab-raw";
    bool found = await minio.BucketExistsAsync(new Minio.DataModel.Args.BucketExistsArgs().WithBucket(bucket));
    if (!found)
        await minio.MakeBucketAsync(new Minio.DataModel.Args.MakeBucketArgs().WithBucket(bucket));

    await minio.PutObjectAsync(new Minio.DataModel.Args.PutObjectArgs()
        .WithBucket(bucket)
        .WithObject(s3Key)
        .WithStreamData(ctx.Request.Body)
        .WithObjectSize(ctx.Request.ContentLength ?? -1)
        .WithContentType(contentType));

    return Results.Ok(new { fileId, s3Key, bucket });
}).RequireAuthorization()
.DisableAntiforgery();

app.MapGet("/health", () => Results.Ok(new { status = "healthy", service = "upload" }));

app.Run();
