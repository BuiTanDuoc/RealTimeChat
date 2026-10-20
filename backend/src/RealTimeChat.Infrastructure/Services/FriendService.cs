using AutoMapper;
using Microsoft.EntityFrameworkCore;
using RealTimeChat.Application.Common;
using RealTimeChat.Application.DTOs;
using RealTimeChat.Application.Interfaces;
using RealTimeChat.Domain.Entities;
using RealTimeChat.Infrastructure.Persistence;

namespace RealTimeChat.Infrastructure.Services;

public class FriendService(AppDbContext db, IMapper mapper, IPresenceTracker presence) : IFriendService
{
    public async Task<List<UserDto>> GetFriendsAsync(Guid userId)
    {
        var rows = await db.Friendships.AsNoTracking()
            .Include(f => f.Requester).Include(f => f.Addressee)
            .Where(f => f.Status == FriendshipStatus.Accepted && (f.RequesterId == userId || f.AddresseeId == userId))
            .ToListAsync();
        return rows.Select(f => ToUser(f.RequesterId == userId ? f.Addressee : f.Requester))
            .OrderBy(u => u.DisplayName).ToList();
    }

    public async Task<List<FriendRequestDto>> GetRequestsAsync(Guid userId)
    {
        var rows = await db.Friendships.AsNoTracking()
            .Include(f => f.Requester).Include(f => f.Addressee)
            .Where(f => f.Status == FriendshipStatus.Pending && (f.RequesterId == userId || f.AddresseeId == userId))
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync();
        return rows.Select(f => ToRequest(f, userId)).ToList();
    }

    public async Task<FriendRequestDto> SendRequestAsync(Guid userId, Guid targetId)
    {
        if (userId == targetId) throw new AppException("You cannot add yourself.");
        var target = await db.Users.FindAsync(targetId) ?? throw new AppException("User not found.", 404);

        var existing = await db.Friendships.FirstOrDefaultAsync(f =>
            (f.RequesterId == userId && f.AddresseeId == targetId) ||
            (f.RequesterId == targetId && f.AddresseeId == userId));
        if (existing is not null)
        {
            if (existing.Status == FriendshipStatus.Accepted) throw new AppException("You are already friends.", 409);
            if (existing.RequesterId == userId) throw new AppException("Friend request already sent.", 409);
            throw new AppException($"{target.DisplayName} already sent you a request. Accept it from your requests.", 409);
        }

        var f = new Friendship { RequesterId = userId, AddresseeId = targetId };
        db.Friendships.Add(f);
        await db.SaveChangesAsync();
        await db.Entry(f).Reference(x => x.Requester).LoadAsync();
        await db.Entry(f).Reference(x => x.Addressee).LoadAsync();
        return ToRequest(f, userId);
    }

    public async Task<UserDto> AcceptAsync(Guid userId, Guid requestId)
    {
        var f = await db.Friendships.Include(x => x.Requester)
                    .FirstOrDefaultAsync(x => x.Id == requestId && x.AddresseeId == userId && x.Status == FriendshipStatus.Pending)
                ?? throw new AppException("Friend request not found.", 404);
        f.Status = FriendshipStatus.Accepted;
        f.RespondedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return ToUser(f.Requester);
    }

    public async Task<Guid> RemoveRequestAsync(Guid userId, Guid requestId)
    {
        var f = await db.Friendships.FirstOrDefaultAsync(x =>
                    x.Id == requestId && x.Status == FriendshipStatus.Pending &&
                    (x.RequesterId == userId || x.AddresseeId == userId))
                ?? throw new AppException("Friend request not found.", 404);
        var other = f.RequesterId == userId ? f.AddresseeId : f.RequesterId;
        db.Friendships.Remove(f);
        await db.SaveChangesAsync();
        return other;
    }

    public async Task UnfriendAsync(Guid userId, Guid friendId)
    {
        var f = await db.Friendships.FirstOrDefaultAsync(x => x.Status == FriendshipStatus.Accepted &&
                    ((x.RequesterId == userId && x.AddresseeId == friendId) ||
                     (x.RequesterId == friendId && x.AddresseeId == userId)))
                ?? throw new AppException("You are not friends with this user.", 404);
        db.Friendships.Remove(f);
        await db.SaveChangesAsync();
    }

    private UserDto ToUser(AppUser u)
    {
        var dto = mapper.Map<UserDto>(u);
        dto.IsOnline = presence.IsOnline(u.Id);
        return dto;
    }

    private FriendRequestDto ToRequest(Friendship f, Guid viewerId)
    {
        var incoming = f.AddresseeId == viewerId;
        return new FriendRequestDto
        {
            Id = f.Id,
            CreatedAt = f.CreatedAt,
            Direction = incoming ? "Incoming" : "Outgoing",
            User = ToUser(incoming ? f.Requester : f.Addressee)
        };
    }
}
