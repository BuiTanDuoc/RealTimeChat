using AutoMapper;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RealTimeChat.Application.Common;
using RealTimeChat.Application.DTOs;
using RealTimeChat.Application.Interfaces;
using RealTimeChat.Domain.Entities;
using RealTimeChat.Infrastructure.Persistence;

namespace RealTimeChat.Infrastructure.Services;

public class AuthService(UserManager<AppUser> users, AppDbContext db, ITokenService tokens, IMapper mapper) : IAuthService
{
    public async Task<AuthResponse> RegisterAsync(RegisterRequest r)
    {
        var user = new AppUser { UserName = r.UserName.Trim(), Email = r.Email.Trim(), DisplayName = r.DisplayName.Trim() };
        var result = await users.CreateAsync(user, r.Password);
        if (!result.Succeeded)
            throw new AppException(string.Join(" ", result.Errors.Select(e => e.Description)));
        return await IssueAsync(user);
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest r)
    {
        var user = await users.FindByNameAsync(r.UserName.Trim()) ?? await users.FindByEmailAsync(r.UserName.Trim());
        if (user is null || !await users.CheckPasswordAsync(user, r.Password))
            throw new AppException("Invalid username or password.", 401);
        return await IssueAsync(user);
    }

    public async Task<AuthResponse> RefreshAsync(string refreshToken)
    {
        var hash = tokens.Hash(refreshToken);
        var stored = await db.RefreshTokens.Include(t => t.User).FirstOrDefaultAsync(t => t.TokenHash == hash);
        if (stored is null || !stored.IsActive) throw new AppException("Session expired. Please sign in again.", 401);

        stored.RevokedAt = DateTime.UtcNow;   // rotate: each refresh token is single-use
        return await IssueAsync(stored.User);
    }

    public async Task LogoutAsync(string refreshToken)
    {
        var hash = tokens.Hash(refreshToken);
        var stored = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash);
        if (stored is { RevokedAt: null })
        {
            stored.RevokedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
    }

    private async Task<AuthResponse> IssueAsync(AppUser user)
    {
        var refresh = tokens.GenerateRefreshToken();
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = tokens.Hash(refresh),
            ExpiresAt = DateTime.UtcNow.Add(tokens.RefreshTokenLifetime)
        });
        await db.SaveChangesAsync();

        return new AuthResponse
        {
            AccessToken = tokens.CreateAccessToken(user),
            RefreshToken = refresh,
            User = mapper.Map<UserDto>(user)
        };
    }
}
