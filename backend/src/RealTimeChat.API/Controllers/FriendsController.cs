using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using RealTimeChat.API.Extensions;
using RealTimeChat.API.Hubs;
using RealTimeChat.Application.DTOs;
using RealTimeChat.Application.Interfaces;

namespace RealTimeChat.API.Controllers;

[ApiController, Authorize, Route("api/friends")]
public class FriendsController(IFriendService friends, IUserService users, IHubContext<ChatHub> hub) : ControllerBase
{
    private IClientProxy Client(Guid userId) => hub.Clients.User(userId.ToString());

    [HttpGet]
    public async Task<ActionResult<List<UserDto>>> List() => Ok(await friends.GetFriendsAsync(User.GetUserId()));

    [HttpGet("requests")]
    public async Task<ActionResult<List<FriendRequestDto>>> Requests() => Ok(await friends.GetRequestsAsync(User.GetUserId()));

    [HttpPost("requests")]
    public async Task<ActionResult<FriendRequestDto>> Send(SendFriendRequest body)
    {
        var me = User.GetUserId();
        var dto = await friends.SendRequestAsync(me, body.UserId);

        // The recipient sees the same request from their side.
        await Client(body.UserId).SendAsync("FriendRequestReceived", new FriendRequestDto
        {
            Id = dto.Id, CreatedAt = dto.CreatedAt, Direction = "Incoming", User = await users.GetAsync(me)
        });
        return Ok(dto);
    }

    [HttpPost("requests/{id:guid}/accept")]
    public async Task<ActionResult<UserDto>> Accept(Guid id)
    {
        var me = User.GetUserId();
        var newFriend = await friends.AcceptAsync(me, id);
        await Client(newFriend.Id).SendAsync("FriendRequestAccepted", new { requestId = id, user = await users.GetAsync(me) });
        return Ok(newFriend);
    }

    /// <summary>Decline an incoming request, or cancel one you sent.</summary>
    [HttpDelete("requests/{id:guid}")]
    public async Task<IActionResult> RemoveRequest(Guid id)
    {
        var other = await friends.RemoveRequestAsync(User.GetUserId(), id);
        await Client(other).SendAsync("FriendRequestRemoved", id);
        return NoContent();
    }

    [HttpDelete("{userId:guid}")]
    public async Task<IActionResult> Unfriend(Guid userId)
    {
        var me = User.GetUserId();
        await friends.UnfriendAsync(me, userId);
        await Client(userId).SendAsync("FriendRemoved", me);
        return NoContent();
    }
}
