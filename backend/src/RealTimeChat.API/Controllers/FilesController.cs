using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealTimeChat.Application.Common;
using RealTimeChat.Application.DTOs;
using RealTimeChat.Application.Interfaces;

namespace RealTimeChat.API.Controllers;

[ApiController, Authorize, Route("api/files")]
public class FilesController(IFileStorage storage) : ControllerBase
{
    public const long MaxBytes = 25 * 1024 * 1024;

    /// <summary>Upload an attachment (also used for images pasted from the clipboard).</summary>
    [HttpPost("upload")]
    [RequestSizeLimit(MaxBytes + 1024 * 1024)]
    public async Task<ActionResult<UploadResult>> Upload(IFormFile file)
    {
        if (file is null || file.Length == 0) throw new AppException("No file received.");
        if (file.Length > MaxBytes) throw new AppException("Files must be 25 MB or smaller.", 413);

        var name = Path.GetFileName(file.FileName);
        await using var stream = file.OpenReadStream();
        var url = await storage.SaveAsync(stream, name, "files");
        return Ok(new UploadResult { Url = url, FileName = name, Size = file.Length, IsImage = storage.IsImage(name) });
    }
}
