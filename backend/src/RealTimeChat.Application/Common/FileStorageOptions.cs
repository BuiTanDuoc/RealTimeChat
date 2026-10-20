namespace RealTimeChat.Application.Common;

/// <summary>Bound from the "FileStorage" section of appsettings.json.</summary>
public class FileStorageOptions
{
    public const string SectionName = "FileStorage";

    /// <summary>Largest attachment, in megabytes (decimals allowed, e.g. 0.5).</summary>
    public double MaxFileSizeMB { get; set; } = 25;

    /// <summary>Largest avatar image, in megabytes.</summary>
    public double MaxAvatarSizeMB { get; set; } = 5;

    /// <summary>Whitelist for attachments. Leave empty to allow every type that is not blocked.</summary>
    public List<string>? AllowedExtensions { get; set; }

    /// <summary>Always rejected. When omitted, a safe built-in list (executables, scripts, HTML/SVG) is used.</summary>
    public List<string>? BlockedExtensions { get; set; }

    /// <summary>Extensions shown inline as photos and accepted as avatars.</summary>
    public List<string>? ImageExtensions { get; set; }

    public long MaxFileBytes => (long)(MaxFileSizeMB * 1024 * 1024);
    public long MaxAvatarBytes => (long)(MaxAvatarSizeMB * 1024 * 1024);
}
