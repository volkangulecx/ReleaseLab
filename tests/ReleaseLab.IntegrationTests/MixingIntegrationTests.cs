using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;

namespace ReleaseLab.IntegrationTests;

public class MixingIntegrationTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;

    public MixingIntegrationTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });
    }

    private async Task<string> RegisterAndGetTokenAsync(string? email = null)
    {
        email ??= $"mix-{Guid.NewGuid():N}@example.com";
        var payload = new { email, password = "Test1234!", displayName = "Mix Test User" };
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", payload);
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await response.Content.ReadFromJsonAsync<AuthResponseDto>();
        body.Should().NotBeNull();
        return body!.AccessToken;
    }

    // ── POST /api/v1/mix/projects ──

    [Fact]
    public async Task CreateProject_WithAuth_ReturnsCreated()
    {
        var token = await RegisterAndGetTokenAsync();

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/mix/projects");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(new { name = "Test Mix Project" });

        var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<MixProjectResponseDto>();
        body.Should().NotBeNull();
        body!.Id.Should().NotBeEmpty();
        body.Name.Should().Be("Test Mix Project");
        body.Status.Should().Be("draft");
    }

    [Fact]
    public async Task CreateProject_WithDefaultName_ReturnsUntitledMix()
    {
        var token = await RegisterAndGetTokenAsync();

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/mix/projects");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(new { name = (string?)null });

        var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<MixProjectResponseDto>();
        body.Should().NotBeNull();
        body!.Name.Should().Be("Untitled Mix");
    }

    // ── GET /api/v1/mix/projects ──

    [Fact]
    public async Task ListProjects_WithAuth_ReturnsOk()
    {
        var token = await RegisterAndGetTokenAsync();

        // Create a project first
        var createRequest = new HttpRequestMessage(HttpMethod.Post, "/api/v1/mix/projects");
        createRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        createRequest.Content = JsonContent.Create(new { name = "List Test Project" });
        await _client.SendAsync(createRequest);

        // List projects
        var listRequest = new HttpRequestMessage(HttpMethod.Get, "/api/v1/mix/projects");
        listRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(listRequest);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<MixProjectListItemDto[]>();
        body.Should().NotBeNull();
        body!.Should().HaveCountGreaterThanOrEqualTo(1);
        body.Should().Contain(p => p.Name == "List Test Project");
    }

    [Fact]
    public async Task ListProjects_ReturnsOnlyOwnProjects()
    {
        var token1 = await RegisterAndGetTokenAsync();
        var token2 = await RegisterAndGetTokenAsync();

        // User 1 creates a project
        var createRequest = new HttpRequestMessage(HttpMethod.Post, "/api/v1/mix/projects");
        createRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token1);
        createRequest.Content = JsonContent.Create(new { name = "User1 Project" });
        await _client.SendAsync(createRequest);

        // User 2 lists projects - should not see User 1's project
        var listRequest = new HttpRequestMessage(HttpMethod.Get, "/api/v1/mix/projects");
        listRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token2);

        var response = await _client.SendAsync(listRequest);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<MixProjectListItemDto[]>();
        body.Should().NotBeNull();
        body.Should().NotContain(p => p.Name == "User1 Project");
    }

    // ── Unauthenticated ──

    [Fact]
    public async Task CreateProject_WithoutAuth_ReturnsUnauthorized()
    {
        var payload = new { name = "Should Fail" };

        var response = await _client.PostAsJsonAsync("/api/v1/mix/projects", payload);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ListProjects_WithoutAuth_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync("/api/v1/mix/projects");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── DTOs ──

    private record AuthResponseDto(string AccessToken, string RefreshToken, DateTime ExpiresAt);

    private record MixProjectResponseDto(
        Guid Id,
        string Name,
        string Status,
        DateTime CreatedAt
    );

    private record MixProjectListItemDto(
        Guid Id,
        string Name,
        string Status,
        short Progress,
        int TrackCount,
        DateTime CreatedAt,
        DateTime UpdatedAt
    );
}
