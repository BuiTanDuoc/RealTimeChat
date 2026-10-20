using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using RealTimeChat.API.Hubs;
using RealTimeChat.API.Middleware;
using RealTimeChat.Application.Common;
using RealTimeChat.Application.Interfaces;
using RealTimeChat.Infrastructure;
using RealTimeChat.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

var uploadsRoot = Path.Combine(builder.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(uploadsRoot);

// Request-body limits follow FileStorage:MaxFileSizeMB / MaxAvatarSizeMB (plus 1 MB for form overhead).
var fileOpts = builder.Configuration.GetSection(FileStorageOptions.SectionName).Get<FileStorageOptions>() ?? new FileStorageOptions();
var bodyLimit = Math.Max(fileOpts.MaxFileBytes, fileOpts.MaxAvatarBytes) + 1024 * 1024;
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = bodyLimit);
builder.Services.Configure<FormOptions>(o => o.MultipartBodyLengthLimit = bodyLimit);

builder.Services.AddInfrastructure(builder.Configuration, uploadsRoot);
builder.Services.AddControllers();
builder.Services.AddSignalR();

// ---------- JWT ----------
var jwt = builder.Configuration.GetSection("Jwt");
var key = jwt["Key"];
if (string.IsNullOrWhiteSpace(key) || key.Length < 32)
    throw new InvalidOperationException("Jwt:Key must be at least 32 characters (use user-secrets or an env var).");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt["Issuer"],
            ValidAudience = jwt["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            ClockSkew = TimeSpan.FromSeconds(30)
        };
        // Browsers cannot set headers on WebSocket connections, so SignalR sends the token in the query string.
        o.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) && ctx.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                    ctx.Token = token;
                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddAuthorization();

// ---------- CORS ----------
var origins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? new[] { "http://localhost:5173" };
builder.Services.AddCors(o => o.AddPolicy("web", p =>
    p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

// ---------- Swagger ----------
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "RealTimeChat API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization", Type = SecuritySchemeType.Http, Scheme = "bearer",
        BearerFormat = "JWT", In = ParameterLocation.Header, Description = "Paste the access token only."
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        [new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }] = Array.Empty<string>()
    });
});

var app = builder.Build();

app.UseMiddleware<ExceptionMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();

    // Dev convenience. For production switch to migrations:
    //   dotnet ef migrations add Initial -p src/RealTimeChat.Infrastructure -s src/RealTimeChat.API
    //   dotnet ef database update        -p src/RealTimeChat.Infrastructure -s src/RealTimeChat.API
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.EnsureCreatedAsync();
    await DevSchemaPatches.EnsureFriendshipsTableAsync(db);
}

app.UseCors("web");

var storage = app.Services.GetRequiredService<IFileStorage>();
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsRoot),
    RequestPath = "/uploads",
    OnPrepareResponse = ctx =>
    {
        var h = ctx.Context.Response.Headers;
        h["X-Content-Type-Options"] = "nosniff";
        h["Cross-Origin-Resource-Policy"] = "cross-origin";
        // Only images render inline; everything else downloads.
        if (!storage.IsImage(ctx.File.Name))
            h["Content-Disposition"] = "attachment";
    }
});

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<ChatHub>("/hubs/chat");

app.Run();
