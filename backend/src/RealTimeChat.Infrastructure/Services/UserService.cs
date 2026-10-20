using AutoMapper;
using Microsoft.EntityFrameworkCore;
using RealTimeChat.Application.Common;
using RealTimeChat.Application.DTOs;
using RealTimeChat.Application.Interfaces;
using RealTimeChat.Infrastructure.Persistence;

namespace RealTimeChat.Infrastructure.Services;

public class UserService(AppDbContext db, IMapper mapper, IFileStorage storage, IPresenceTracker presence) : IUserService
{
    private const long MaxAvatarBytes = 5 * 1024 * 1024;

    public async Task<UserDto> GetAsync(Guid userId)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId)
                   ?? throw new AppException("User not found.", 404);
        return ToDto(user);
    }

    public async Task<List<UserDto>> SearchAsync(Guid currentUserId, string query)
    {
        query = query.Trim();
        if (query.Length == 0) return new();
        var found = await db.Users.AsNoTracking()
            .Where(u => u.Id != currentUserId &&
                        (u.DisplayName.Contains(query) || u.UserName!.Contains(query)))
            .OrderBy(u => u.DisplayName)
            .Take(20)
            .ToListAsync();

        var ids = found.Select(u => u.Id).ToList();
        var relations = await db.Friendships.AsNoTracking()
            .Where(f => (f.RequesterId == currentUserId && ids.Contains(f.AddresseeId)) ||
                        (f.AddresseeId == currentUserId && ids.Contains(f.RequesterId)))
            .ToListAsync();

        return found.Select(u =>
        {
            var dto = ToDto(u);
            var f = relations.FirstOrDefault(x => x.RequesterId == u.Id || x.AddresseeId == u.Id);
            dto.Friendship = f is null ? "None"
                : f.Status == Domain.Entities.FriendshipStatus.Accepted ? "Friends"
                : f.RequesterId == currentUserId ? "RequestSent" : "RequestReceived";
            dto.FriendRequestId = f is { Status: Domain.Entities.FriendshipStatus.Pending } ? f.Id : null;
            return dto;
        }).ToList();
    }

    public async Task<UserDto> UpdateProfileAsync(Guid userId, UpdateProfileRequest request)
    {
        var user = await db.Users.FindAsync(userId) ?? throw new AppException("User not found.", 404);
        user.DisplayName = request.DisplayName.Trim();
        await db.SaveChangesAsync();
        return ToDto(user);
    }

    public async Task<UserDto> UploadAvatarAsync(Guid userId, Stream content, string fileName)
    {
        if (!storage.IsImage(fileName)) throw new AppException("Avatar must be an image (jpg, png, gif, webp).");
        if (content.CanSeek && content.Length > MaxAvatarBytes) throw new AppException("Avatar must be 5 MB or smaller.");

        var user = await db.Users.FindAsync(userId) ?? throw new AppException("User not found.", 404);
        user.AvatarUrl = await storage.SaveAsync(content, fileName, "avatars");
        await db.SaveChangesAsync();
        return ToDto(user);
    }

    public async Task SetLastSeenAsync(Guid userId, DateTime at)
    {
        await db.Users.Where(u => u.Id == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.LastSeenAt, at));
    }

    private UserDto ToDto(Domain.Entities.AppUser u)
    {
        var dto = mapper.Map<UserDto>(u);
        dto.IsOnline = presence.IsOnline(u.Id);
        return dto;
    }
}
