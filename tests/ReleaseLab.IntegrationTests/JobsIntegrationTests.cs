using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;

namespace ReleaseLab.IntegrationTests;

public class JobsIntegrationTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;
    private readonly CustomWebApplicationFactory _factory;

    public JobsIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });
    }

    private async Task<string> RegisterAndGetTokenAsync(string? email = null)
    {
        email ??= $"jobs-{Guid.NewGuid():N}@example.com";
        var payload = new { email, password = "Test1234!", displayName = "Jobs Test User" };
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", payload);
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await response.Content.ReadFromJsonAsync<AuthResponseDto>();
        body.Should().NotBeNull();
        return body!.AccessToken;
    }

    [Fact]
    public async Task CreateJob_WithoutAuth_ReturnsUnauthorized()
    {
        var payload = new { fileId = Guid.NewGuid(), preset = "Balanced", quality = "Standard" };

        var response = await _client.PostAsJsonAsync("/api/v1/jobs", payload);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ListJobs_WithAuth_ReturnsOkWithPaginatedResponse()
    {
        var token = await RegisterAndGetTokenAsync();

        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/jobs");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<PaginatedJobsDto>();
        body.Should().NotBeNull();
        body!.Data.Should().NotBeNull();
        body.Total.Should().BeGreaterThanOrEqualTo(0);
        body.Page.Should().BeGreaterThanOrEqualTo(1);
        body.PageSize.Should().BeGreaterThan(0);
        body.TotalPages.Should().BeGreaterThanOrEqualTo(0);
    }

    [Fact]
    public async Task HealthCheck_ReturnsOk()
    {
        var response = await _client.GetAsync("/health");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ── DTOs for deserialization ──

    private record AuthResponseDto(string AccessToken, string RefreshToken, DateTime ExpiresAt);

    private record PaginatedJobsDto(
        JobResponseDto[] Data,
        int Total,
        int Page,
        int PageSize,
        int TotalPages
    );

    private record JobResponseDto(
        Guid Id,
        string Status,
        string Preset,
        string Quality,
        short Progress,
        string? ErrorMessage,
        DateTime CreatedAt,
        DateTime? FinishedAt
    );
}
