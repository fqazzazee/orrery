// SPDX-License-Identifier: GPL-2.0-or-later
// Orrery and the rest of Windows: whether it is the screensaver and the
// wallpaper, and the ways to make it so.

using Microsoft.Win32;

namespace Orrery;

public static class Integration
{
    // Whether the screensaver Windows starts is an Orrery.scr.
    public static bool ScreensaverIsOrrery()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(@"Control Panel\Desktop");
            var scr = key?.GetValue("SCRNSAVE.EXE") as string;
            var active = key?.GetValue("ScreenSaveActive") as string;
            return scr != null && active != "0" &&
                Path.GetFileName(scr).Equals("Orrery.scr", StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    // The old Screen Saver Settings dialog, where Orrery can be picked.
    public static bool OpenScreensaverSettings()
    {
        System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("control.exe", "desk.cpl,,@screensaver") { UseShellExecute = true });
        return true;
    }

    // Whether an Orrery wallpaper process is running (Wallpaper.cs holds the mutex).
    public static bool WallpaperRunning()
    {
        try
        {
            return Mutex.TryOpenExisting(Wallpaper.MutexName, out var m) && m != null;
        }
        catch
        {
            return false;
        }
    }

    // The wallpaper process waits on this event and quits when it is set.
    public const string QuitEventName = @"Local\Orrery.Wallpaper.Quit";

    public static bool StopWallpaper()
    {
        if (!EventWaitHandle.TryOpenExisting(QuitEventName, out var quit))
            return false;
        using (quit)
            quit.Set();
        return true;
    }

    // Makes Orrery.scr (next to this exe) the screensaver. Built in ScreenSaver.cs.
    public static bool SetScreensaver() => ScreenSaver.MakeCurrent();

    public static bool StartWallpaper()
    {
        if (WallpaperRunning())
            return true;
        System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(Environment.ProcessPath!, "--wallpaper") { UseShellExecute = false });
        return true;
    }
}
