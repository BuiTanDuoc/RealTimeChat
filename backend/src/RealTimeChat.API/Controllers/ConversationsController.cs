using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using RealTimeChat.API.Extensions;
using RealTimeChat.API.Hubs;
using RealTimeChat.Application.DTOs;
using RealTimeChat.Application.Interfaces;

namespace RealTimeChat.API.Controllers;

[ApiController, Authorize, Route("api/conversations")]
public class ConversationsController(IChatService chat, IHubContext<ChatHub> hub) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<ConversationDto>>> List() =>
        Ok(await chat.GetConversationsAsync(User.GetUserId()));

    [HttpPost("private")]
    public async Task<ActionResult<ConversationDto>> Private(CreatePrivateConversationRequest request) =>
        Ok(await chat.GetOrCreatePrivateAsync(User.GetUserId(), request.UserId));

    [HttpPost("group")]
    public async Task<ActionResult<ConversationDto>> Group(CreateGroupRequest request)
    {
        var me = User.GetUserId();
        var dto = await chat.CreateGroupAsync(me, request.Name, request.MemberIds);

        // Let the other members see the new group right away.
        var others = dto.Participants.Where(p => p.Id != me).Select(p => p.Id.ToString()).ToList();
        await hub.Clients.Users(others).SendAsync("ConversationCreated", dto);
        return Ok(dto);
    }

    /// <param name="before">ISO timestamp; returns messages older than this (pagination).</param>
    [HttpGet("{id:guid}/messages")]
    public async Task<ActionResult<List<MessageDto>>> Messages(Guid id, [FromQuery] DateTimeOffset? before, [FromQuery] int take = 50) =>
        Ok(await chat.GetMessagesAsync(User.GetUserId(), id, before?.UtcDateTime, take));
}
