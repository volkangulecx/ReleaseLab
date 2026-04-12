using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using Minio;
using Moq;
using ReleaseLab.Application.Interfaces;
using ReleaseLab.Infrastructure.Data;
using StackExchange.Redis;

namespace ReleaseLab.IntegrationTests;

public class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.UseSetting("Jwt:Secret", "ThisIsAVeryLongSecretKeyForTestingPurposesOnly1234567890!");
        builder.UseSetting("Jwt:Issuer", "ReleaseLab.Test");
        builder.UseSetting("Jwt:Audience", "ReleaseLab.Test");
        builder.UseSetting("ConnectionStrings:Postgres", "Host=localhost;Database=test");
        builder.UseSetting("Redis:Connection", "localhost:6379");

        builder.ConfigureServices(services =>
        {
            // ── Replace PostgreSQL with InMemory ──
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.RemoveAll<AppDbContext>();
            services.RemoveAll<IAppDbContext>();

            var dbName = $"ReleaseLab_Test_{Guid.NewGuid()}";
            services.AddDbContext<AppDbContext>(options =>
                options.UseInMemoryDatabase(dbName));
            services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

            // ── Replace Redis with mock ──
            services.RemoveAll<IConnectionMultiplexer>();
            var redisMock = new Mock<IConnectionMultiplexer>();
            var subscriberMock = new Mock<ISubscriber>();
            redisMock.Setup(x => x.GetSubscriber(It.IsAny<object>())).Returns(subscriberMock.Object);
            var dbMock = new Mock<IDatabase>();
            redisMock.Setup(x => x.GetDatabase(It.IsAny<int>(), It.IsAny<object>())).Returns(dbMock.Object);
            services.AddSingleton(redisMock.Object);

            // ── Replace MinIO with mock ──
            services.RemoveAll<IMinioClient>();
            var minioMock = new Mock<IMinioClient>();
            services.AddSingleton(minioMock.Object);

            // ── Replace IEmailService with mock ──
            services.RemoveAll<IEmailService>();
            var emailMock = new Mock<IEmailService>();
            emailMock.Setup(x => x.SendVerificationEmailAsync(It.IsAny<string>(), It.IsAny<string>()))
                .Returns(Task.CompletedTask);
            emailMock.Setup(x => x.SendPasswordResetEmailAsync(It.IsAny<string>(), It.IsAny<string>()))
                .Returns(Task.CompletedTask);
            services.AddSingleton(emailMock.Object);

            // ── Replace IQueueService with mock ──
            services.RemoveAll<IQueueService>();
            var queueMock = new Mock<IQueueService>();
            queueMock.Setup(x => x.EnqueueMasteringJobAsync(
                    It.IsAny<ReleaseLab.Contracts.Messages.MasteringJobMessage>(),
                    It.IsAny<ReleaseLab.Domain.Enums.UserPlan>()))
                .Returns(Task.CompletedTask);
            services.AddSingleton(queueMock.Object);

            // ── Replace IStorageService with mock ──
            services.RemoveAll<IStorageService>();
            var storageMock = new Mock<IStorageService>();
            services.AddSingleton(storageMock.Object);

            // ── Replace IPaymentService with mock ──
            services.RemoveAll<IPaymentService>();
            var paymentMock = new Mock<IPaymentService>();
            services.AddSingleton(paymentMock.Object);

            // ── Replace ISubscriptionService with mock ──
            services.RemoveAll<ISubscriptionService>();
            var subscriptionMock = new Mock<ISubscriptionService>();
            subscriptionMock.Setup(x => x.CanCreateMasterAsync(It.IsAny<Guid>()))
                .ReturnsAsync(true);
            subscriptionMock.Setup(x => x.IncrementUsageAsync(It.IsAny<Guid>()))
                .Returns(Task.CompletedTask);
            services.AddSingleton(subscriptionMock.Object);

            // ── Replace IAudioAnalysisService with mock ──
            services.RemoveAll<IAudioAnalysisService>();
            var audioMock = new Mock<IAudioAnalysisService>();
            services.AddSingleton(audioMock.Object);

            // ── Remove health checks that depend on Postgres/Redis ──
            services.Configure<HealthCheckServiceOptions>(options =>
            {
                options.Registrations.Clear();
            });

            // ── Ensure DB is created ──
            var sp = services.BuildServiceProvider();
            using var scope = sp.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Database.EnsureCreated();
        });
    }
}
