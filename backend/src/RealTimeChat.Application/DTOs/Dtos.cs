using System.ComponentModel.DataAnnotations;

namespace RealTimeChat.Application.DTOs;

// ---------- Auth ----------
public class RegisterRequest
{
    [Required, StringLength(32, MinimumLength = 3), RegularExpression(@"^[a-zA-Z0-9_.\-]+$")]
    public string UserName { get; set; } = "";
    [Required, StringLength(50, MinimumLength = 1)]
    public string DisplayName { get; set; } = "";
    [Required, EmailAddress]
    public string Email { get; set; } = "";
    [Required, MinLength(6)]
    public string Password { get; set; } = "";
}

public class LoginRequest
{
    [Required] public string UserName { get; set; } = "";   // username or email
    [Required] public string Password { get; set; } = "";
}

public class RefreshRequest
{
    [Required] public string RefreshToken { get; set; } = "";
}

public class AuthResponse
{
    public string AccessToken { get; set; } = "";
    public string RefreshToken { get; set; } = "";
    public UserDto User { get; set; } = null!;
}

// ---------- Users ----------
public class UserDto
{
    public Guid Id { get; set; }
    public string UserName { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? AvatarUrl { get; set; }
    public bool IsOnline { get; set; }
    public DateTime? LastSeenAt { get; set; }

    /// <summary>Only filled in user-search results: None | Friends | RequestSent | RequestReceived.</summary>
    public string? Friendship { get; set; }
    /// <summary>Pending request id when Friendship is RequestSent / RequestReceived.</summary>
    public Guid? FriendRequestId { get; set; }
}

public class UpdateProfileRequest
{
    [Required, StringLength(50, MinimumLength = 1)]
    public string DisplayName { get; set; } = "";
}

// ---------- Chat ----------
public class ReceiptDto
{
    public Guid UserId { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public DateTime? ReadAt { get; set; }
}

public class MessageDto
{
    public Guid Id { get; set; }
    public Guid ConversationId { get; set; }
    public Guid SenderId { get; set; }
    public string SenderName { get; set; } = "";
    public string? Content { get; set; }
    public string Type { get; set; } = "Text";
    public string? FileUrl { get; set; }
    public string? FileName { get; set; }
    public long? FileSize { get; set; }
    public DateTime SentAt { get; set; }
    public List<ReceiptDto> Receipts { get; set; } = new();
}

public class ConversationDto
{
    public Guid Id { get; set; }
    public string? Name { get; set; }
    public bool IsGroup { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<UserDto> Participants { get; set; } = new();
    public MessageDto? LastMessage { get; set; }
    public int UnreadCount { get; set; }
}

public class SendMessageRequest
{
    public Guid ConversationId { get; set; }
    public string? Content { get; set; }
    public string Type { get; set; } = "Text";   // Text | Image | File
    public string? FileUrl { get; set; }
    public string? FileName { get; set; }
    public long? FileSize { get; set; }
}

public class CreatePrivateConversationRequest
{
    [Required] public Guid UserId { get; set; }
}

public class CreateGroupRequest
{
    [Required, StringLength(100, MinimumLength = 1)]
    public string Name { get; set; } = "";
    [Required, MinLength(1)]
    public List<Guid> MemberIds { get; set; } = new();
}

public class UploadResult
{
    public string Url { get; set; } = "";
    public string FileName { get; set; } = "";
    public long Size { get; set; }
    public bool IsImage { get; set; }
}

// ---------- Friends ----------
public class SendFriendRequest
{
    [Required] public Guid UserId { get; set; }
}

public class FriendRequestDto
{
    public Guid Id { get; set; }
    /// <summary>The other person (sender for Incoming, recipient for Outgoing).</summary>
    public UserDto User { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public string Direction { get; set; } = "Incoming";   // Incoming | Outgoing
}
