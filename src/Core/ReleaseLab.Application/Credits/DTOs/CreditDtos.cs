namespace ReleaseLab.Application.Credits.DTOs;

public record PurchaseCreditsRequest(int CreditAmount, string SuccessUrl, string CancelUrl);
public record CreditBalanceResponse(int Balance, IEnumerable<CreditHistoryItem> RecentHistory);
public record CreditHistoryItem(int Delta, string Reason, int BalanceAfter, DateTime CreatedAt);
