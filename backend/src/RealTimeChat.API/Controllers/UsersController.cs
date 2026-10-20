using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealTimeChat.API.Extensions;
using RealTimeChat.Application.DTOs;
using RealTimeChat.Application.Interfaces;

namespace RealTimeChat.API.Controllers;

[ApiController, Authorize, Route("api/users")]
public class UsersController(IUserService users) : ControllerBase
{
    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> Me() => Ok(await users.GetAsync(User.GetUserId()));

    [HttpGet("search")]
    public async Task<ActionResult<List<UserDto>>> Search([FromQuery] string q = "") =>
        Ok(await users.SearchAsync(User.GetUserId(), q));

    [HttpPut("me")]
    public async Task<ActionResult<UserDto>> UpdateProfile(UpdateProfileRequest request) =>
        Ok(await users.UpdateProfileAsync(User.GetUserId(), request));

    [HttpPost("me/avatar")]
    public async Task<ActionResult<UserDto>> UploadAvatar(IFormFile file)
    {
        await using var stream = file.OpenReadStream();
        return Ok(await users.UploadAvatarAsync(User.GetUserId(), stream, file.FileName));
    }
}
