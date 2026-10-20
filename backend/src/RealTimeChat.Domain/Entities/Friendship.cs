namespace RealTimeChat.Domain.Entities;

public enum FriendshipStatus { Pending, Accepted }

/// <summary>
/// One row per pair. A pending row means Requester invited Addressee; accepting flips it to Accepted.
/// Declining, cancelling and unfriending simply delete the row.
/// </summary>
public class Friendship
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RequesterId { get; set; }
    public AppUser Requester { get; set; } = null!;
    public Guid AddresseeId { get; set; }
    public AppUser Addressee { get; set; } = null!;
    public FriendshipStatus Status { get; set; } = FriendshipStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RespondedAt { get; set; }
}
