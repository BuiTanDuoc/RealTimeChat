using AutoMapper;
using Microsoft.EntityFrameworkCore;
using RealTimeChat.Application.Common;
using RealTimeChat.Application.DTOs;
using RealTimeChat.Application.Interfaces;
using RealTimeChat.Domain.Entities;
using RealTimeChat.Infrastructure.Persistence;

namespace RealTimeChat.Infrastructure.Services;

public class ChatService(AppDbContext db, IMapper mapper, IPresenceTracker presence) : IChatService
{
    // ---------- Conversations ----------
    public async Task<List<ConversationDto>> GetConversationsAsync(Guid userId)
    {
        var convs = await db.Conversations.AsNoTracking()
            .Include(c => c.Participants).ThenInclude(p => p.User)
            .Where(c => c.Participants.Any(p => p.UserId == userId))
            .ToListAsync();
        var dtos = await BuildAsync(convs, userId);
        return dtos.OrderByDescending(d => d.LastMessage?.SentAt ?? d.CreatedAt).ToList();
    }

    public async Task<ConversationDto> GetConversationAsync(Guid userId, Guid conversationId)
    {
        var conv = await db.Conversations.AsNoTracking()
            .Include(c => c.Participants).ThenInclude(p => p.User)
            .FirstOrDefaultAsync(c => c.Id == conversationId)
            ?? throw new AppException("Conversation not found.", 404);
        if (conv.Participants.All(p => p.UserId != userId)) throw new AppException("Not a member of this conversation.", 403);
        return (await BuildAsync(new List<Conversation> { conv }, userId))[0];
    }

    public async Task<ConversationDto> GetOrCreatePrivateAsync(Guid userId, Guid otherUserId)
    {
        if (userId == otherUserId) throw new AppException("You cannot start a chat with yourself.");
        if (!await db.Users.AnyAsync(u => u.Id == otherUserId)) throw new AppException("User not found.", 404);

        var existing = await db.Conversations
            .Where(c => !c.IsGroup
                        && c.Participants.Any(p => p.UserId == userId)
                        && c.Participants.Any(p => p.UserId == otherUserId))
            .Select(c => (Guid?)c.Id)
            .FirstOrDefaultAsync();
        if (existing.HasValue) return await GetConversationAsync(userId, existing.Value);

        var conv = new Conversation { IsGroup = false, CreatedById = userId };
        conv.Participants.Add(new ConversationParticipant { UserId = userId });
        conv.Participants.Add(new ConversationParticipant { UserId = otherUserId });
        db.Conversations.Add(conv);
        await db.SaveChangesAsync();
        return await GetConversationAsync(userId, conv.Id);
    }

    public async Task<ConversationDto> CreateGroupAsync(Guid userId, string name, IEnumerable<Guid> memberIds)
    {
        name = name.Trim();
        if (name.Length == 0) throw new AppException("Group name is required.");

        var ids = memberIds.Append(userId).Distinct().ToList();
        if (ids.Count < 2) throw new AppException("Add at least one other member.");
        var valid = await db.Users.Where(u => ids.Contains(u.Id)).CountAsync();
        if (valid != ids.Count) throw new AppException("One or more members do not exist.");

        var conv = new Conversation { Name = name, IsGroup = true, CreatedById = userId };
        foreach (var id in ids) conv.Participants.Add(new ConversationParticipant { UserId = id });
        db.Conversations.Add(conv);
        await db.SaveChangesAsync();
        return await GetConversationAsync(userId, conv.Id);
    }

    // ---------- Messages ----------
    public async Task<List<MessageDto>> GetMessagesAsync(Guid userId, Guid conversationId, DateTime? before, int take)
    {
        await EnsureMemberAsync(userId, conversationId);
        take = Math.Clamp(take, 1, 100);

        var q = db.Messages.AsNoTracking()
            .Include(m => m.Sender).Include(m => m.Receipts)
            .Where(m => m.ConversationId == conversationId);
        if (before.HasValue) q = q.Where(m => m.SentAt < before.Value);

        var list = await q.OrderByDescending(m => m.SentAt).Take(take).ToListAsync();
        list.Reverse();
        return mapper.Map<List<MessageDto>>(list);
    }

    public async Task<MessageDto> SendMessageAsync(Guid userId, SendMessageRequest req)
    {
        var participantIds = await GetParticipantIdsAsync(req.ConversationId);
        if (!participantIds.Contains(userId)) throw new AppException("Not a member of this conversation.", 403);
        if (!Enum.TryParse<MessageType>(req.Type, true, out var type)) throw new AppException("Unknown message type.");

        var content = req.Content?.Trim();
        if (content is { Length: > 4000 }) throw new AppException("Message is too long (max 4000 characters).");

        if (type == MessageType.Text)
        {
            if (string.IsNullOrEmpty(content)) throw new AppException("Message is empty.");
        }
        else if (string.IsNullOrEmpty(req.FileUrl) || !req.FileUrl.StartsWith("/uploads/files/") || req.FileUrl.Contains(".."))
        {
            throw new AppException("Invalid attachment.");
        }

        var msg = new Message
        {
            ConversationId = req.ConversationId,
            SenderId = userId,
            Type = type,
            Content = string.IsNullOrEmpty(content) ? null : content,
            FileUrl = type == MessageType.Text ? null : req.FileUrl,
            FileName = type == MessageType.Text ? null : Path.GetFileName(req.FileName ?? "file"),
            FileSize = type == MessageType.Text ? null : req.FileSize
        };
        foreach (var pid in participantIds.Where(p => p != userId))
            msg.Receipts.Add(new MessageReceipt { UserId = pid });

        db.Messages.Add(msg);
        await db.SaveChangesAsync();
        await db.Entry(msg).Reference(m => m.Sender).LoadAsync();
        return mapper.Map<MessageDto>(msg);
    }

    public Task<List<Guid>> GetParticipantIdsAsync(Guid conversationId) =>
        db.ConversationParticipants.Where(p => p.ConversationId == conversationId)
            .Select(p => p.UserId).ToListAsync();

    // ---------- Receipts ----------
    public async Task<IReadOnlyList<StatusChange>> MarkDeliveredAsync(Guid userId, IEnumerable<Guid>? messageIds = null)
    {
        var q = db.MessageReceipts.Include(r => r.Message)
            .Where(r => r.UserId == userId && r.DeliveredAt == null);
        if (messageIds is not null)
        {
            var ids = messageIds.ToList();
            q = q.Where(r => ids.Contains(r.MessageId));
        }

        var receipts = await q.ToListAsync();
        var now = DateTime.UtcNow;
        foreach (var r in receipts) r.DeliveredAt = now;
        await db.SaveChangesAsync();
        return receipts.Select(r => new StatusChange(r.Message.ConversationId, r.MessageId, r.Message.SenderId)).ToList();
    }

    public async Task<IReadOnlyList<StatusChange>> MarkReadAsync(Guid userId, Guid conversationId)
    {
        await EnsureMemberAsync(userId, conversationId);
        var receipts = await db.MessageReceipts.Include(r => r.Message)
            .Where(r => r.UserId == userId && r.ReadAt == null && r.Message.ConversationId == conversationId)
            .ToListAsync();

        var now = DateTime.UtcNow;
        foreach (var r in receipts)
        {
            r.ReadAt = now;
            r.DeliveredAt ??= now;
        }
        await db.SaveChangesAsync();
        return receipts.Select(r => new StatusChange(conversationId, r.MessageId, r.Message.SenderId)).ToList();
    }

    // ---------- helpers ----------
    private async Task EnsureMemberAsync(Guid userId, Guid conversationId)
    {
        if (!await db.ConversationParticipants.AnyAsync(p => p.ConversationId == conversationId && p.UserId == userId))
            throw new AppException("Conversation not found.", 404);
    }

    private async Task<List<ConversationDto>> BuildAsync(List<Conversation> convs, Guid userId)
    {
        var ids = convs.Select(c => c.Id).ToList();

        var last = await db.Messages.AsNoTracking()
            .Include(m => m.Sender).Include(m => m.Receipts)
            .Where(m => ids.Contains(m.ConversationId) &&
                        m.SentAt == db.Messages.Where(x => x.ConversationId == m.ConversationId).Max(x => x.SentAt))
            .ToListAsync();
        var lastBy = last.GroupBy(m => m.ConversationId).ToDictionary(g => g.Key, g => g.First());

        var unread = await db.MessageReceipts
            .Where(r => r.UserId == userId && r.ReadAt == null && ids.Contains(r.Message.ConversationId))
            .GroupBy(r => r.Message.ConversationId)
            .Select(g => new { Id = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Id, x => x.Count);

        return convs.Select(c => new ConversationDto
        {
            Id = c.Id,
            Name = c.Name,
            IsGroup = c.IsGroup,
            CreatedAt = c.CreatedAt,
            Participants = c.Participants.Select(p =>
            {
                var u = mapper.Map<UserDto>(p.User);
                u.IsOnline = presence.IsOnline(p.UserId);
                return u;
            }).ToList(),
            LastMessage = lastBy.TryGetValue(c.Id, out var m) ? mapper.Map<MessageDto>(m) : null,
            UnreadCount = unread.GetValueOrDefault(c.Id)
        }).ToList();
    }
}
