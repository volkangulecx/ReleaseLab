using System.IdentityModel.Tokens.Jwt;
using System.Security.Cryptography;
using System.Text;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using ReleaseLab.Api.Services;
using ReleaseLab.Domain.Entities;
using ReleaseLab.Domain.Enums;

namespace ReleaseLab.UnitTests;

public class JwtServiceTests
{
    private readonly JwtService _sut;
    private readonly IConfiguration _config;

    private const string TestSecret = "SuperSecretKeyForTestingPurposesThatIsLongEnough1234567890!";
    private const string TestIssuer = "test-issuer";
    private const string TestAudience = "test-audience";

    public JwtServiceTests()
    {
        var configData = new Dictionary<string, string?>
        {
            ["Jwt:Secret"] = TestSecret,
            ["Jwt:Issuer"] = TestIssuer,
            ["Jwt:Audience"] = TestAudience,
        };

        _config = new ConfigurationBuilder()
            .AddInMemoryCollection(configData)
            .Build();

        _sut = new JwtService(_config);
    }

    // ── GenerateAccessToken ──

    [Fact]
    public void GenerateAccessToken_ReturnsNonEmptyString()
    {
        var user = CreateTestUser();

        var token = _sut.GenerateAccessToken(user);

        token.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public void GenerateAccessToken_ReturnsValidJwt()
    {
        var user = CreateTestUser();

        var token = _sut.GenerateAccessToken(user);

        var handler = new JwtSecurityTokenHandler();
        handler.CanReadToken(token).Should().BeTrue();

        var jwt = handler.ReadJwtToken(token);
        jwt.Issuer.Should().Be(TestIssuer);
        jwt.Audiences.Should().Contain(TestAudience);
    }

    [Fact]
    public void GenerateAccessToken_ContainsCorrectClaims()
    {
        var user = CreateTestUser();

        var token = _sut.GenerateAccessToken(user);

        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(token);

        jwt.Claims.Should().Contain(c => c.Type == JwtRegisteredClaimNames.Sub && c.Value == user.Id.ToString());
        jwt.Claims.Should().Contain(c => c.Type == JwtRegisteredClaimNames.Email && c.Value == user.Email);
        jwt.Claims.Should().Contain(c => c.Type == "plan" && c.Value == user.Plan.ToString());
        jwt.Claims.Should().Contain(c => c.Type == JwtRegisteredClaimNames.Jti);
    }

    [Fact]
    public void GenerateAccessToken_SetsExpirationInTheFuture()
    {
        var user = CreateTestUser();

        var token = _sut.GenerateAccessToken(user);

        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(token);

        jwt.ValidTo.Should().BeAfter(DateTime.UtcNow);
        jwt.ValidTo.Should().BeCloseTo(DateTime.UtcNow.AddMinutes(15), TimeSpan.FromMinutes(1));
    }

    [Fact]
    public void GenerateAccessToken_DifferentUsers_ProduceDifferentTokens()
    {
        var user1 = CreateTestUser();
        var user2 = CreateTestUser(email: "other@example.com");

        var token1 = _sut.GenerateAccessToken(user1);
        var token2 = _sut.GenerateAccessToken(user2);

        token1.Should().NotBe(token2);
    }

    // ── GenerateRefreshToken ──

    [Fact]
    public void GenerateRefreshToken_ReturnsNonEmptyString()
    {
        var token = _sut.GenerateRefreshToken();

        token.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public void GenerateRefreshToken_ReturnsBase64String()
    {
        var token = _sut.GenerateRefreshToken();

        var act = () => Convert.FromBase64String(token);
        act.Should().NotThrow();

        var bytes = Convert.FromBase64String(token);
        bytes.Should().HaveCount(32);
    }

    [Fact]
    public void GenerateRefreshToken_ProducesUniqueTokens()
    {
        var tokens = Enumerable.Range(0, 50)
            .Select(_ => _sut.GenerateRefreshToken())
            .ToList();

        tokens.Should().OnlyHaveUniqueItems();
    }

    // ── HashToken ──

    [Fact]
    public void HashToken_ReturnsConsistentHash()
    {
        var token = "test-token-value";

        var hash1 = _sut.HashToken(token);
        var hash2 = _sut.HashToken(token);

        hash1.Should().Be(hash2);
    }

    [Fact]
    public void HashToken_ReturnsLowercaseHexString()
    {
        var hash = _sut.HashToken("test-token");

        hash.Should().MatchRegex("^[0-9a-f]+$");
    }

    [Fact]
    public void HashToken_ReturnsSha256Hash()
    {
        var input = "test-token";
        var expectedBytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        var expected = Convert.ToHexString(expectedBytes).ToLowerInvariant();

        var hash = _sut.HashToken(input);

        hash.Should().Be(expected);
        hash.Should().HaveLength(64); // SHA256 produces 32 bytes = 64 hex chars
    }

    [Fact]
    public void HashToken_DifferentInputs_ProduceDifferentHashes()
    {
        var hash1 = _sut.HashToken("token-a");
        var hash2 = _sut.HashToken("token-b");

        hash1.Should().NotBe(hash2);
    }

    // ── Helpers ──

    private static User CreateTestUser(
        string email = "test@example.com",
        UserPlan plan = UserPlan.Free)
    {
        return new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            PasswordHash = "hashed",
            Plan = plan,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }
}
