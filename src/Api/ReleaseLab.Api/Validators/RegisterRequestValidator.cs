using FluentValidation;
using ReleaseLab.Application.Auth.DTOs;

namespace ReleaseLab.Api.Validators;

public class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required")
            .EmailAddress().WithMessage("Invalid email format")
            .MaximumLength(255);

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password is required")
            .MinimumLength(6).WithMessage("Password must be at least 6 characters")
            .MaximumLength(128).WithMessage("Password too long");

        RuleFor(x => x.DisplayName)
            .MaximumLength(100).When(x => x.DisplayName is not null);
    }
}

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty();
    }
}

public class CreateJobRequestValidator : AbstractValidator<Application.Jobs.DTOs.CreateJobRequest>
{
    public CreateJobRequestValidator()
    {
        RuleFor(x => x.FileId).NotEmpty();
        RuleFor(x => x.Preset).NotEmpty()
            .Must(p => new[] { "Warm", "Bright", "Loud", "Balanced" }.Contains(p, StringComparer.OrdinalIgnoreCase))
            .WithMessage("Preset must be Warm, Bright, Loud, or Balanced");
        RuleFor(x => x.Quality).NotEmpty()
            .Must(q => new[] { "Preview", "HiRes" }.Contains(q, StringComparer.OrdinalIgnoreCase))
            .WithMessage("Quality must be Preview or HiRes");
    }
}

public class UploadInitRequestValidator : AbstractValidator<Application.Uploads.DTOs.UploadInitRequest>
{
    private static readonly string[] AllowedTypes = { "audio/wav", "audio/x-wav", "audio/mpeg", "audio/flac", "audio/x-flac" };

    public UploadInitRequestValidator()
    {
        RuleFor(x => x.FileName).NotEmpty().MaximumLength(255);
        RuleFor(x => x.SizeBytes).GreaterThan(0).WithMessage("File cannot be empty");
        RuleFor(x => x.ContentType).NotEmpty()
            .Must(ct => AllowedTypes.Contains(ct.ToLowerInvariant()))
            .WithMessage("Unsupported format. Use WAV, MP3, or FLAC");
    }
}
