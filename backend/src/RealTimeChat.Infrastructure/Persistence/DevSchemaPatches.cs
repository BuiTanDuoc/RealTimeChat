using Microsoft.EntityFrameworkCore;

namespace RealTimeChat.Infrastructure.Persistence;

/// <summary>
/// Development only. EnsureCreated never alters an existing database, so tables added later are created here
/// (idempotent). Replace with EF migrations before production.
/// </summary>
public static class DevSchemaPatches
{
    public static Task EnsureFriendshipsTableAsync(AppDbContext db) => db.Database.ExecuteSqlRawAsync(@"
IF OBJECT_ID(N'dbo.Friendships', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Friendships (
        Id uniqueidentifier NOT NULL CONSTRAINT PK_Friendships PRIMARY KEY,
        RequesterId uniqueidentifier NOT NULL,
        AddresseeId uniqueidentifier NOT NULL,
        Status nvarchar(10) NOT NULL,
        CreatedAt datetime2 NOT NULL,
        RespondedAt datetime2 NULL,
        CONSTRAINT FK_Friendships_AspNetUsers_RequesterId FOREIGN KEY (RequesterId) REFERENCES dbo.AspNetUsers (Id),
        CONSTRAINT FK_Friendships_AspNetUsers_AddresseeId FOREIGN KEY (AddresseeId) REFERENCES dbo.AspNetUsers (Id)
    );
    CREATE UNIQUE INDEX IX_Friendships_RequesterId_AddresseeId ON dbo.Friendships (RequesterId, AddresseeId);
    CREATE INDEX IX_Friendships_AddresseeId ON dbo.Friendships (AddresseeId);
END");
}
