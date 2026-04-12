using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using ReleaseLab.Api.Controllers;
using ReleaseLab.Application.Auth.DTOs;
using ReleaseLab.Application.Interfaces;
using ReleaseLab.Domain.Entities;
using ReleaseLab.Domain.Enums;

namespace ReleaseLab.UnitTests;

public class AuthControllerTests : IDisposable
{
    private readonly TestAppDbContext _db;
    private readonly Mock<IJwtService> _jwtMock;
    private readonly Mock<IEmailService> _emailMock;
    private readonly AuthController _controller;

    public AuthControllerTests()
    {
        var options = new DbContextOptionsBuilder<TestAppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _db = new TestAppDbContext(options);
        _jwtMock = new Mock<IJwtService>();
        _emailMock = new Mock<IEmailService>();

        _jwtMock.Setup(j => j.GenerateAccessToken(It.IsAny<User>())).Returns("test-access-token");
        _jwtMock.Setup(j => j.GenerateRefreshToken()).Returns("test-refresh-token");
        _jwtMock.Setup(j => j.HashToken(It.IsAny<string>())).Returns("hashed-token");

        _controller = new AuthController(_db, _jwtMock.Object, _emailMock.Object);
    }

    public void Dispose()
    {
        _db.Dispose();
    }

    // ── Register Validation ──

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("notanemail")]
    public async Task Register_WithInvalidEmail_ReturnsBadRequest(string email)
    {
        var request = new RegisterRequest(email, "validPassword123", "Test User");

        var result = await _controller.Register(request);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.Value.Should().BeEquivalentTo(new { message = "Invalid email address" });
    }

    [Fact]
    public async Task Register_WithNullEmail_ReturnsBadRequest()
    {
        var request = new RegisterRequest(null!, "validPassword123", "Test User");

        var result = await _controller.Register(request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Theory]
    [InlineData("")]
    [InlineData("12345")]
    [InlineData("ab")]
    public async Task Register_WithShortPassword_ReturnsBadRequest(string password)
    {
        var request = new RegisterRequest("test@example.com", password, "Test User");

        var result = await _controller.Register(request);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.Value.Should().BeEquivalentTo(new { message = "Password must be at least 6 characters" });
    }

    [Fact]
    public async Task Register_WithPasswordTooLong_ReturnsBadRequest()
    {
        var longPassword = new string('a', 129);
        var request = new RegisterRequest("test@example.com", longPassword, "Test User");

        var result = await _controller.Register(request);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.Value.Should().BeEquivalentTo(new { message = "Password too long" });
    }

    [Fact]
    public async Task Register_WithDuplicateEmail_ReturnsConflict()
    {
        _db.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            Email = "existing@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        var request = new RegisterRequest("existing@example.com", "validPassword123", "Test User");

        var result = await _controller.Register(request);

        var conflict = result.Should().BeOfType<ConflictObjectResult>().Subject;
        conflict.Value.Should().BeEquivalentTo(new { message = "Email already registered" });
    }

    [Fact]
    public async Task Register_WithValidData_ReturnsCreated()
    {
        var request = new RegisterRequest("newuser@example.com", "validPassword123", "New User");

        var result = await _controller.Register(request);

        var created = result.Should().BeOfType<CreatedResult>().Subject;
        var response = created.Value.Should().BeOfType<AuthResponse>().Subject;
        response.AccessToken.Should().Be("test-access-token");
        response.RefreshToken.Should().Be("test-refresh-token");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == "newuser@example.com");
        user.Should().NotBeNull();
        user!.DisplayName.Should().Be("New User");
    }

    [Fact]
    public async Task Register_WithValidData_SendsVerificationEmail()
    {
        var request = new RegisterRequest("newuser@example.com", "validPassword123", "New User");

        await _controller.Register(request);

        _emailMock.Verify(
            e => e.SendVerificationEmailAsync("newuser@example.com", It.IsAny<string>()),
            Times.Once);
    }

    [Fact]
    public async Task Register_NormalizesEmail_ToLowerCase()
    {
        var request = new RegisterRequest("Test@EXAMPLE.COM", "validPassword123", "Test User");

        await _controller.Register(request);

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == "test@example.com");
        user.Should().NotBeNull();
    }

    // ── Login ──

    [Fact]
    public async Task Login_WithValidCredentials_ReturnsOkWithTokens()
    {
        var passwordHash = BCrypt.Net.BCrypt.HashPassword("correctPassword");
        _db.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            Email = "user@example.com",
            PasswordHash = passwordHash,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        var request = new LoginRequest("user@example.com", "correctPassword");

        var result = await _controller.Login(request);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<AuthResponse>().Subject;
        response.AccessToken.Should().Be("test-access-token");
        response.RefreshToken.Should().Be("test-refresh-token");
    }

    [Fact]
    public async Task Login_WithWrongPassword_ReturnsUnauthorized()
    {
        var passwordHash = BCrypt.Net.BCrypt.HashPassword("correctPassword");
        _db.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            Email = "user@example.com",
            PasswordHash = passwordHash,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        var request = new LoginRequest("user@example.com", "wrongPassword");

        var result = await _controller.Login(request);

        var unauthorized = result.Should().BeOfType<UnauthorizedObjectResult>().Subject;
        unauthorized.Value.Should().BeEquivalentTo(new { message = "Invalid email or password" });
    }

    [Fact]
    public async Task Login_WithNonExistentEmail_ReturnsUnauthorized()
    {
        var request = new LoginRequest("nonexistent@example.com", "somePassword");

        var result = await _controller.Login(request);

        var unauthorized = result.Should().BeOfType<UnauthorizedObjectResult>().Subject;
        unauthorized.Value.Should().BeEquivalentTo(new { message = "Invalid email or password" });
    }

    [Fact]
    public async Task Login_StoresRefreshTokenInDatabase()
    {
        var passwordHash = BCrypt.Net.BCrypt.HashPassword("correctPassword");
        _db.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            Email = "user@example.com",
            PasswordHash = passwordHash,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        var request = new LoginRequest("user@example.com", "correctPassword");

        await _controller.Login(request);

        var tokens = await _db.RefreshTokens.ToListAsync();
        tokens.Should().HaveCount(1);
        tokens[0].TokenHash.Should().Be("hashed-token");
    }

    // ── Helper DbContext for InMemory ──

    private class TestAppDbContext : DbContext, IAppDbContext
    {
        public TestAppDbContext(DbContextOptions<TestAppDbContext> options) : base(options) { }

        public DbSet<User> Users => Set<User>();
        public DbSet<AudioFile> Files => Set<AudioFile>();
        public DbSet<Job> Jobs => Set<Job>();
        public DbSet<CreditLedgerEntry> CreditLedgerEntries => Set<CreditLedgerEntry>();
        public DbSet<Payment> Payments => Set<Payment>();
        public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
        public DbSet<VerificationCode> VerificationCodes => Set<VerificationCode>();
    }
}
