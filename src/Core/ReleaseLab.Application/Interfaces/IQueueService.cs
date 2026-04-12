using ReleaseLab.Contracts.Messages;

namespace ReleaseLab.Application.Interfaces;

public interface IQueueService
{
    Task EnqueueMasteringJobAsync(MasteringJobMessage message);
    Task PublishProgressAsync(JobProgressMessage message);
    Task PublishCompletedAsync(JobCompletedMessage message);
    Task PublishFailedAsync(JobFailedMessage message);
}
