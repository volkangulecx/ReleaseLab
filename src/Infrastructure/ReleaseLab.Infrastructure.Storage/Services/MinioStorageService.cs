using Minio;
using Minio.DataModel.Args;
using ReleaseLab.Application.Interfaces;

namespace ReleaseLab.Infrastructure.Storage.Services;

public class MinioStorageService : IStorageService
{
    private readonly IMinioClient _minio;

    public MinioStorageService(IMinioClient minio)
    {
        _minio = minio;
    }

    public async Task<string> GeneratePresignedUploadUrlAsync(string bucket, string key, string contentType, int expiryMinutes = 15)
    {
        await EnsureBucketExistsAsync(bucket);

        var url = await _minio.PresignedPutObjectAsync(new PresignedPutObjectArgs()
            .WithBucket(bucket)
            .WithObject(key)
            .WithExpiry(expiryMinutes * 60));

        return url;
    }

    public async Task<string> GeneratePresignedDownloadUrlAsync(string bucket, string key, int expiryMinutes = 5)
    {
        var url = await _minio.PresignedGetObjectAsync(new PresignedGetObjectArgs()
            .WithBucket(bucket)
            .WithObject(key)
            .WithExpiry(expiryMinutes * 60));

        return url;
    }

    public async Task<bool> ObjectExistsAsync(string bucket, string key)
    {
        try
        {
            await _minio.StatObjectAsync(new StatObjectArgs()
                .WithBucket(bucket)
                .WithObject(key));
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task DeleteObjectAsync(string bucket, string key)
    {
        await _minio.RemoveObjectAsync(new RemoveObjectArgs()
            .WithBucket(bucket)
            .WithObject(key));
    }

    private async Task EnsureBucketExistsAsync(string bucket)
    {
        bool found = await _minio.BucketExistsAsync(new BucketExistsArgs().WithBucket(bucket));
        if (!found)
        {
            await _minio.MakeBucketAsync(new MakeBucketArgs().WithBucket(bucket));
        }
    }
}
