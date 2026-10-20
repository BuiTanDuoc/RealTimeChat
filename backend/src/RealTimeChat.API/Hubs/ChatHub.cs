using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using RealTimeChat.Application.Common;
using RealTimeChat.Application.DTOs;
using RealTimeChat.Application.Interfaces;

namespace RealTimeChat.API.Hubs;

/// <summary>
/// Every client is addressed through its user id (SignalR's NameIdentifier mapping),
/// so there are no groups to manage: new conversations work immediately.
/// </summary>
[Authorize]
public class ChatHub(IChatService chat, IUserService users, IPresenceTracker presence) : Hub
{
    private Guid UserId => Guid.Parse(Context.UserIdentifier!);

    public override async Task OnConnectedAsync()
    {
        var firstConnection = presence.UserConnected(UserId, Context.ConnectionId);

        await Clients.Caller.SendAsync("OnlineUsers", presence.OnlineUserIds());
        if (firstConnection) await Clients.Others.SendAsync("UserOnline", UserId);

        // Everything sent to this user while they were offline is now delivered.
        await NotifyStatus(await chat.MarkDeliveredAsync(UserId), "Delivered", UserId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (presence.UserDisconnected(UserId, Context.ConnectionId))
        {
            var lastSeen = DateTime.UtcNow;
            await users.SetLastSeenAsync(UserId, lastSeen);
            await Clients.Others.SendAsync("UserOffline", new { userId = UserId, lastSeenAt = lastSeen });
        }
        await base.OnDisconnectedAsync(exception);
    }

    public async Task SendMessage(SendMessageRequest request)
    {
        try
        {
            var dto = await chat.SendMessageAsync(UserId, request);
            var participants = await chat.GetParticipantIdsAsync(request.ConversationId);

            await Clients.Users(participants.Select(p => p.ToString()).ToList()).SendAsync("ReceiveMessage", dto);

            // Recipients that are online right now have received it: mark as delivered.
            foreach (var pid in participants.Where(p => p != UserId && presence.IsOnline(p)))
                await NotifyStatus(await chat.MarkDeliveredAsync(pid, new[] { dto.Id }), "Delivered", pid);
        }
        catch (AppException ex) { throw new HubException(ex.Message); }
    }

    public async Task MarkAsRead(Guid conversationId)
    {
        try
        {
            var changes = await chat.MarkReadAsync(UserId, conversationId);
            await NotifyStatus(changes, "Read", UserId);
            await Clients.User(UserId.ToString()).SendAsync("ConversationRead", conversationId); // sync other tabs
        }
        catch (AppException ex) { throw new HubException(ex.Message); }
    }

    private async Task NotifyStatus(IReadOnlyList<StatusChange> changes, string status, Guid recipientId)
    {
        var at = DateTime.UtcNow;
        foreach (var g in changes.GroupBy(c => (c.SenderId, c.ConversationId)))
        {
            await Clients.User(g.Key.SenderId.ToString()).SendAsync("MessageStatus", new
            {
                conversationId = g.Key.ConversationId,
                messageIds = g.Select(x => x.MessageId).ToList(),
                userId = recipientId,
                status,
                at
            });
        }
    }
}
