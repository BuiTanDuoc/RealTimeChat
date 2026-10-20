using Microsoft.Extensions.Options;
using RealTimeChat.Application.Common;
using RealTimeChat.Application.Interfaces;

namespace RealTimeChat.Infrastructure.Services;

public class LocalFileStorage : IFileStorage
{
    public const string AvatarFolder = "avatars";

    // Used only when appsettings does not define the list.
    private static readonly string[] DefaultBlocked =
    {
        ".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".ps1", ".vbs", ".js", ".mjs", ".jar",
        ".sh", ".dll", ".html", ".htm", ".svg", ".xhtml", ".php", ".asp", ".aspx"
    };
    private static readonly string[] DefaultImages = { ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp" };

    private readonly string _root;
    private readonly HashSet<string> _allowed;
    private readonly HashSet<string> _blocked;
    private readonly HashSet<string> _images;

    public FileStorageOptions Options { get; }
    public IReadOnlyCollection<string> AllowedExtensions => _allowed;
    public IReadOnlyCollection<string> BlockedExtensions => _blocked;

    public LocalFileStorage(string rootPath, IOptions<FileStorageOptions> options)
    {
        _root = rootPath;
        Options = options.Value;
        _allowed = Normalize(Options.AllowedExtensions, Array.Empty<string>());
        _blocked = Normalize(Options.BlockedExtensions, DefaultBlocked);
        _images = Normalize(Options.ImageExtensions, DefaultImages);
    }

    private static HashSet<string> Normalize(IEnumerable<string>? source, IEnumerable<string> fallback) =>
        (source ?? fallback)
            .Select(e => e.Trim().ToLowerInvariant())
            .Where(e => e.Length > 0)
            .Select(e => e.StartsWith('.') ? e : "." + e)
            .ToHashSet();

    public bool IsImage(string fileName) => _images.Contains(Path.GetExtension(fileName).ToLowerInvariant());

    private void EnsureAllowed(string fileName, string folder)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        if (_blocked.Contains(ext))
            throw new AppException($"Files of type {(ext.Length > 0 ? ext : "without an extension")} are not allowed.");

        // Avatars only need to be images; the attachment whitelist does not apply to them.
        if (folder != AvatarFolder && _allowed.Count > 0 && !_allowed.Contains(ext))
            throw new AppException($"This file type is not allowed. Allowed types: {string.Join(", ", _allowed.Order())}.");
    }

    public async Task<string> SaveAsync(Stream content, string originalFileName, string folder)
    {
        EnsureAllowed(originalFileName, folder);

        var dir = Path.Combine(_root, folder);
        Directory.CreateDirectory(dir);

        var name = $"{Guid.NewGuid():N}{Path.GetExtension(originalFileName).ToLowerInvariant()}";
        await using var fs = File.Create(Path.Combine(dir, name));
        await content.CopyToAsync(fs);
        return $"/uploads/{folder}/{name}";
    }
}
