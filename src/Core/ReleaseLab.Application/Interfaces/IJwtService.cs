using ReleaseLab.Domain.Entities;

namespace ReleaseLab.Application.Interfaces;

public interface IJwtService
{
    string GenerateAccessToken(User user);
    string GenerateRefreshToken();
    string HashToken(string token);
}
