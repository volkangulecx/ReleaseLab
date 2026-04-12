namespace ReleaseLab.Application.Uploads.DTOs;

public record UploadInitRequest(string FileName, long SizeBytes, string ContentType);
public record UploadInitResponse(Guid FileId, string UploadUrl);
public record UploadCompleteRequest(Guid FileId, string? Checksum);
