using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;

namespace ReleaseLab.IntegrationTests;

public class ReleaseIntegrationTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;

    public ReleaseIntegrationTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });
    }

    private async Task<string> RegisterAndGetTokenAsync(string? email = null)
    {
        email ??= $"release-{Guid.NewGuid():N}@example.com";
        var payload = new { email, password = "Test1234!", displayName = "Release Test User" };
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", payload);
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await response.Content.ReadFromJsonAsync<AuthResponseDto>();
        body.Should().NotBeNull();
        return body!.AccessToken;
    }

    // ── POST /api/v1/releases ──

    [Fact]
    public async Task CreateRelease_WithAuth_ReturnsCreated()
    {
        var token = await RegisterAndGetTokenAsync();

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/releases");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(new
        {
            title = "Test Song",
            artist = "Test Artist",
            genre = "Pop"
        });

        var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<ReleaseResponseDto>();
        body.Should().NotBeNull();
        body!.Id.Should().NotBeEmpty();
        body.Title.Should().Be("Test Song");
        body.Artist.Should().Be("Test Artist");
        body.Genre.Should().Be("Pop");
        body.Status.Should().Be("draft");
    }

    [Fact]
    public async Task CreateRelease_SetsDefaultPlatformsToTrue()
    {
        var token = await RegisterAndGetTokenAsync();

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/releases");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(new
        {
            title = "Platform Test",
            artist = "Test Artist"
        });

        var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<ReleaseResponseDto>();
        body.Should().NotBeNull();
        body!.Platforms.Should().NotBeNull();
        body.Platforms.Spotify.Should().BeTrue();
        body.Platforms.AppleMusic.Should().BeTrue();
        body.Platforms.YouTube.Should().BeTrue();
        body.Platforms.AmazonMusic.Should().BeTrue();
        body.Platforms.Tidal.Should().BeTrue();
        body.Platforms.Deezer.Should().BeTrue();
    }

    // ── GET /api/v1/releases ──

    [Fact]
    public async Task ListReleases_WithAuth_ReturnsOk()
    {
        var token = await RegisterAndGetTokenAsync();

        // Create a release first
        var createRequest = new HttpRequestMessage(HttpMethod.Post, "/api/v1/releases");
        createRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        createRequest.Content = JsonContent.Create(new
        {
            title = "Listed Song",
            artist = "Listed Artist"
        });
        await _client.SendAsync(createRequest);

        // List releases
        var listRequest = new HttpRequestMessage(HttpMethod.Get, "/api/v1/releases");
        listRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(listRequest);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ReleaseResponseDto[]>();
        body.Should().NotBeNull();
        body!.Should().HaveCountGreaterThanOrEqualTo(1);
        body.Should().Contain(r => r.Title == "Listed Song");
    }

    [Fact]
    public async Task ListReleases_ReturnsOnlyOwnReleases()
    {
        var token1 = await RegisterAndGetTokenAsync();
        var token2 = await RegisterAndGetTokenAsync();

        // User 1 creates a release
        var createRequest = new HttpRequestMessage(HttpMethod.Post, "/api/v1/releases");
        createRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token1);
        createRequest.Content = JsonContent.Create(new
        {
            title = "User1 Song",
            artist = "User1 Artist"
        });
        await _client.SendAsync(createRequest);

        // User 2 lists releases - should not see User 1's release
        var listRequest = new HttpRequestMessage(HttpMethod.Get, "/api/v1/releases");
        listRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token2);

        var response = await _client.SendAsync(listRequest);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ReleaseResponseDto[]>();
        body.Should().NotBeNull();
        body.Should().NotContain(r => r.Title == "User1 Song");
    }

    // ── PUT /api/v1/releases/{id} ──

    [Fact]
    public async Task UpdateRelease_WithAuth_ReturnsOkWithUpdatedData()
    {
        var token = await RegisterAndGetTokenAsync();

        // Create a release
        var createRequest = new HttpRequestMessage(HttpMethod.Post, "/api/v1/releases");
        createRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        createRequest.Content = JsonContent.Create(new
        {
            title = "Original Title",
            artist = "Original Artist"
        });
        var createResponse = await _client.SendAsync(createRequest);
        var created = await createResponse.Content.ReadFromJsonAsync<ReleaseResponseDto>();

        // Update the release
        var updateRequest = new HttpRequestMessage(HttpMethod.Put, $"/api/v1/releases/{created!.Id}");
        updateRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        updateRequest.Content = JsonContent.Create(new
        {
            title = "Updated Title",
            artist = "Updated Artist",
            genre = "Rock",
            description = "A great song"
        });

        var response = await _client.SendAsync(updateRequest);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ReleaseResponseDto>();
        body.Should().NotBeNull();
        body!.Title.Should().Be("Updated Title");
        body.Artist.Should().Be("Updated Artist");
        body.Genre.Should().Be("Rock");
        body.Description.Should().Be("A great song");
    }

    [Fact]
    public async Task UpdateRelease_CanDisablePlatforms()
    {
        var token = await RegisterAndGetTokenAsync();

        // Create a release
        var createRequest = new HttpRequestMessage(HttpMethod.Post, "/api/v1/releases");
        createRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        createRequest.Content = JsonContent.Create(new
        {
            title = "Platform Update Test",
            artist = "Test Artist"
        });
        var createResponse = await _client.SendAsync(createRequest);
        var created = await createResponse.Content.ReadFromJsonAsync<ReleaseResponseDto>();

        // Disable some platforms
        var updateRequest = new HttpRequestMessage(HttpMethod.Put, $"/api/v1/releases/{created!.Id}");
        updateRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        updateRequest.Content = JsonContent.Create(new
        {
            spotify = false,
            tidal = false
        });

        var response = await _client.SendAsync(updateRequest);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ReleaseResponseDto>();
        body!.Platforms.Spotify.Should().BeFalse();
        body.Platforms.Tidal.Should().BeFalse();
        body.Platforms.AppleMusic.Should().BeTrue();
    }

    [Fact]
    public async Task UpdateRelease_NonExistent_ReturnsNotFound()
    {
        var token = await RegisterAndGetTokenAsync();

        var request = new HttpRequestMessage(HttpMethod.Put, $"/api/v1/releases/{Guid.NewGuid()}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(new { title = "Ghost" });

        var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Unauthenticated ──

    [Fact]
    public async Task CreateRelease_WithoutAuth_ReturnsUnauthorized()
    {
        var payload = new { title = "No Auth Song", artist = "No Auth Artist" };

        var response = await _client.PostAsJsonAsync("/api/v1/releases", payload);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ListReleases_WithoutAuth_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync("/api/v1/releases");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task UpdateRelease_WithoutAuth_ReturnsUnauthorized()
    {
        var payload = new { title = "No Auth Update" };

        var response = await _client.PutAsJsonAsync($"/api/v1/releases/{Guid.NewGuid()}", payload);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── DTOs ──

    private record AuthResponseDto(string AccessToken, string RefreshToken, DateTime ExpiresAt);

    private record PlatformsDto(
        bool Spotify,
        bool AppleMusic,
        bool YouTube,
        bool AmazonMusic,
        bool Tidal,
        bool Deezer
    );

    private record ReleaseResponseDto(
        Guid Id,
        string Title,
        string Artist,
        string? Album,
        string? Genre,
        string? Isrc,
        string? Upc,
        int? Year,
        string? Language,
        string? Copyright,
        string? Description,
        string? ArtworkS3Key,
        string? AudioS3Key,
        string Status,
        string? DistributorId,
        string? ExternalReleaseId,
        DateTime? ScheduledReleaseDate,
        DateTime? SubmittedAt,
        DateTime? LiveAt,
        PlatformsDto Platforms,
        DateTime CreatedAt,
        DateTime UpdatedAt
    );
}
