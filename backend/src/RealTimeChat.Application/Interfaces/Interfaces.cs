using RealTimeChat.Application.Common;
using RealTimeChat.Application.DTOs;
using RealTimeChat.Domain.Entities;

namespace RealTimeChat.Application.Interfaces;

/// <summary>A message whose receipt changed for some recipient.</summary>
public record StatusChange(Guid ConversationId, Guid MessageId, Guid SenderId);

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request);
    Task<AuthResponse> LoginAsync(LoginRequest request);
    Task<AuthResponse> RefreshAsync(string refreshToken);
    Task LogoutAsync(string refreshToken);
}

public interface ITokenService
{
    string CreateAccessToken(AppUser user);
    string GenerateRefreshToken();
    string Hash(string token);
    TimeSpan RefreshTokenLifetime { get; }
}

public interface IUserService
{
    Task<UserDto> GetAsync(Guid userId);
    Task<List<UserDto>> SearchAsync(Guid currentUserId, string query);
    Task<UserDto> UpdateProfileAsync(Guid userId, UpdateProfileRequest request);
    Task<UserDto> UploadAvatarAsync(Guid userId, Stream content, string fileName);
    Task SetLastSeenAsync(Guid userId, DateTime at);
}

public interface IChatService
{
    Task<List<ConversationDto>> GetConversationsAsync(Guid userId);
    Task<ConversationDto> GetConversationAsync(Guid userId, Guid conversationId);
    Task<ConversationDto> GetOrCreatePrivateAsync(Guid userId, Guid otherUserId);
    Task<ConversationDto> CreateGroupAsync(Guid userId, string name, IEnumerable<Guid> memberIds);
    Task<List<MessageDto>> GetMessagesAsync(Guid userId, Guid conversationId, DateTime? before, int take);
    Task<MessageDto> SendMessageAsync(Guid userId, SendMessageRequest request);
    Task<List<Guid>> GetParticipantIdsAsync(Guid conversationId);
    Task<IReadOnlyList<StatusChange>> MarkDeliveredAsync(Guid userId, IEnumerable<Guid>? messageIds = null);
    Task<IReadOnlyList<StatusChange>> MarkReadAsync(Guid userId, Guid conversationId);
}

public interface IFileStorage
{
    FileStorageOptions Options { get; }
    /// <summary>Normalised (lower-case, leading dot). Empty = no whitelist.</summary>
    IReadOnlyCollection<string> AllowedExtensions { get; }
    IReadOnlyCollection<string> BlockedExtensions { get; }

    /// <returns>Public relative URL such as /uploads/files/abc.png</returns>
    Task<string> SaveAsync(Stream content, string originalFileName, string folder);
    bool IsImage(string fileName);
}

/// <summary>Tracks live connections per user so multiple tabs count as one presence.</summary>
public interface IPresenceTracker
{
    /// <returns>true when this is the user's first connection (just came online)</returns>
    bool UserConnected(Guid userId, string connectionId);
    /// <returns>true when that was the user's last connection (just went offline)</returns>
    bool UserDisconnected(Guid userId, string connectionId);
    bool IsOnline(Guid userId);
    IReadOnlyList<Guid> OnlineUserIds();
}

public interface IFriendService
{
    Task<List<UserDto>> GetFriendsAsync(Guid userId);
    Task<List<FriendRequestDto>> GetRequestsAsync(Guid userId);
    /// <returns>The request as seen by the sender (Outgoing).</returns>
    Task<FriendRequestDto> SendRequestAsync(Guid userId, Guid targetId);
    /// <returns>The requester, who is now a friend.</returns>
    Task<UserDto> AcceptAsync(Guid userId, Guid requestId);
    /// <summary>Decline (recipient) or cancel (sender). Returns the other person's id.</summary>
    Task<Guid> RemoveRequestAsync(Guid userId, Guid requestId);
    Task UnfriendAsync(Guid userId, Guid friendId);
}
