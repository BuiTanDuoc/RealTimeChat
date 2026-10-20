using Microsoft.AspNetCore.Identity;

namespace RealTimeChat.Domain.Entities;

public class AppUser : IdentityUser<Guid>
{
    public AppUser() { Id = Guid.NewGuid(); }

    public string DisplayName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public DateTime? LastSeenAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
