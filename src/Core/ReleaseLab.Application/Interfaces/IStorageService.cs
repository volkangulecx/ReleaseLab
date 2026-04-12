namespace ReleaseLab.Application.Interfaces;

public interface IStorageService
{
    Task<string> GeneratePresignedUploadUrlAsync(string bucket, string key, string contentType, int expiryMinutes = 15);
    Task<string> GeneratePresignedDownloadUrlAsync(string bucket, string key, int expiryMinutes = 5);
    Task<bool> ObjectExistsAsync(string bucket, string key);
    Task DeleteObjectAsync(string bucket, string key);
}
