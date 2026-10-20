using RealTimeChat.Application.Common;
using RealTimeChat.Application.Interfaces;

namespace RealTimeChat.Infrastructure.Services;

public class LocalFileStorage(string rootPath) : IFileStorage
{
    private static readonly HashSet<string> ImageExt = new() { ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp" };

    // Anything that a browser or OS could execute/render as active content.
    private static readonly HashSet<string> Blocked = new()
    {
        ".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".ps1", ".vbs", ".js", ".mjs", ".jar",
        ".sh", ".dll", ".html", ".htm", ".svg", ".xhtml", ".php", ".asp", ".aspx"
    };

    public bool IsImage(string fileName) => ImageExt.Contains(Path.GetExtension(fileName).ToLowerInvariant());

    public async Task<string> SaveAsync(Stream content, string originalFileName, string folder)
    {
        var ext = Path.GetExtension(originalFileName).ToLowerInvariant();
        if (Blocked.Contains(ext)) throw new AppException($"Files of type {ext} are not allowed.");

        var dir = Path.Combine(rootPath, folder);
        Directory.CreateDirectory(dir);

        var name = $"{Guid.NewGuid():N}{ext}";
        await using var fs = File.Create(Path.Combine(dir, name));
        await content.CopyToAsync(fs);
        return $"/uploads/{folder}/{name}";
    }
}
