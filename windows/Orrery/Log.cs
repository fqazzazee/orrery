// SPDX-License-Identifier: GPL-2.0-or-later
// A small log in %LOCALAPPDATA%\Orrery\orrery.log: a screensaver and a
// wallpaper have no console to say what went wrong.

namespace Orrery;

public static class Log
{
    static readonly string LogPath = Path.Combine(Page.DataFolder, "orrery.log");
    static readonly object gate = new();

    public static void Write(string message)
    {
        try
        {
            lock (gate)
            {
                Directory.CreateDirectory(Page.DataFolder);
                var info = new FileInfo(LogPath);
                if (info.Exists && info.Length > 512 * 1024)
                    File.Move(LogPath, LogPath + ".old", overwrite: true);
                File.AppendAllText(LogPath, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} [{Environment.ProcessId}] {message}{Environment.NewLine}");
            }
        }
        catch
        {
            // Nowhere left to say it.
        }
        System.Diagnostics.Debug.WriteLine(message);
    }
}
