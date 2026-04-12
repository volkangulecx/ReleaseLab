using ReleaseLab.Contracts.Messages;
using ReleaseLab.Domain.Enums;

namespace ReleaseLab.Application.Interfaces;

public interface IQueueService
{
    Task EnqueueMasteringJobAsync(MasteringJobMessage message, UserPlan userPlan = UserPlan.Free);
    Task PublishProgressAsync(JobProgressMessage message);
    Task PublishCompletedAsync(JobCompletedMessage message);
    Task PublishFailedAsync(JobFailedMessage message);
}
