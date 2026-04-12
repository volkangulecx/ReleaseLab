using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;

namespace ReleaseLab.IntegrationTests;

public class AuthIntegrationTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;
    private readonly CustomWebApplicationFactory _factory;

    public AuthIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });
    }

    private async Task<string> RegisterAndGetTokenAsync(string email = "testuser@example.com", string password = "Test1234!")
    {
        var registerPayload = new { email, password, displayName = "Test User" };
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", registerPayload);
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await response.Content.ReadFromJsonAsync<AuthResponseDto>();
        body.Should().NotBeNull();
        body!.AccessToken.Should().NotBeNullOrWhiteSpace();
        return body.AccessToken;
    }

    [Fact]
    public async Task Register_ReturnsCreatedWithTokens()
    {
        var payload = new { email = "register-test@example.com", password = "Test1234!", displayName = "Register Test" };

        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", payload);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<AuthResponseDto>();
        body.Should().NotBeNull();
        body!.AccessToken.Should().NotBeNullOrWhiteSpace();
        body.RefreshToken.Should().NotBeNullOrWhiteSpace();
        body.ExpiresAt.Should().BeAfter(DateTime.UtcNow);
    }

    [Fact]
    public async Task Login_WithRegisteredUser_ReturnsOk()
    {
        var email = "login-test@example.com";
        var password = "Test1234!";

        // Register first
        var registerPayload = new { email, password, displayName = "Login Test" };
        var registerResponse = await _client.PostAsJsonAsync("/api/v1/auth/register", registerPayload);
        registerResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        // Login
        var loginPayload = new { email, password };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginPayload);

        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await loginResponse.Content.ReadFromJsonAsync<AuthResponseDto>();
        body.Should().NotBeNull();
        body!.AccessToken.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task Login_WithWrongPassword_ReturnsUnauthorized()
    {
        var email = "wrongpw-test@example.com";
        var password = "Test1234!";

        // Register first
        var registerPayload = new { email, password, displayName = "Wrong PW Test" };
        await _client.PostAsJsonAsync("/api/v1/auth/register", registerPayload);

        // Login with wrong password
        var loginPayload = new { email, password = "WrongPassword123!" };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginPayload);

        loginResponse.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Me_WithValidToken_ReturnsUserProfile()
    {
        var email = "me-test@example.com";
        var token = await RegisterAndGetTokenAsync(email);

        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/me");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<UserProfileDto>();
        body.Should().NotBeNull();
        body!.Email.Should().Be(email);
    }

    [Fact]
    public async Task Me_WithoutToken_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync("/api/v1/me");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Register_DuplicateEmail_ReturnsConflict()
    {
        var email = "duplicate-test@example.com";
        var payload = new { email, password = "Test1234!", displayName = "Dup Test" };

        var first = await _client.PostAsJsonAsync("/api/v1/auth/register", payload);
        first.StatusCode.Should().Be(HttpStatusCode.Created);

        var second = await _client.PostAsJsonAsync("/api/v1/auth/register", payload);
        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    // ── DTOs for deserialization ──

    private record AuthResponseDto(string AccessToken, string RefreshToken, DateTime ExpiresAt);

    private record UserProfileDto(
        Guid Id,
        string Email,
        string? DisplayName,
        string Plan,
        int CreditBalance,
        DateTime CreatedAt
    );
}
