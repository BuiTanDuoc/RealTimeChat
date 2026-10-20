namespace RealTimeChat.Domain.Entities;

public enum MessageType { Text, Image, File }

public class Message
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ConversationId { get; set; }
    public Conversation Conversation { get; set; } = null!;
    public Guid SenderId { get; set; }
    public AppUser Sender { get; set; } = null!;

    public string? Content { get; set; }
    public MessageType Type { get; set; }
    public string? FileUrl { get; set; }
    public string? FileName { get; set; }
    public long? FileSize { get; set; }
    public DateTime SentAt { get; set; } = DateTime.UtcNow;

    /// <summary>One receipt per recipient (everyone except the sender).</summary>
    public List<MessageReceipt> Receipts { get; set; } = new();
}

public class MessageReceipt
{
    public Guid MessageId { get; set; }
    public Message Message { get; set; } = null!;
    public Guid UserId { get; set; }
    public AppUser User { get; set; } = null!;
    public DateTime? DeliveredAt { get; set; }
    public DateTime? ReadAt { get; set; }
}
