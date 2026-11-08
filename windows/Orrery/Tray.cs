// SPDX-License-Identifier: GPL-2.0-or-later
// The live wallpaper's tray icon: open Orrery or the wallpaper's settings,
// pause, start with Windows, quit.

using Microsoft.Win32;

namespace Orrery;

sealed class Tray : IDisposable
{
    const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
    const string RunValue = "Orrery";

    readonly LiveWallpaper wallpaper;
    readonly NotifyIcon icon;
    readonly ToolStripMenuItem pause;
    readonly ToolStripMenuItem startup;

    public Tray(LiveWallpaper wallpaper)
    {
        this.wallpaper = wallpaper;
        var menu = new ContextMenuStrip();
        var open = new ToolStripMenuItem("Open Orrery", null, (_, _) => Launch(""));
        open.Font = new Font(open.Font, FontStyle.Bold);
        menu.Items.Add(open);
        menu.Items.Add(new ToolStripMenuItem("Wallpaper settings", null, (_, _) => Launch("--settings wallpaper")));
        menu.Items.Add(new ToolStripSeparator());
        pause = new ToolStripMenuItem("Pause", null, (_, _) => wallpaper.SetUserPaused(!wallpaper.Paused));
        menu.Items.Add(pause);
        startup = new ToolStripMenuItem("Start with Windows", null, (_, _) => SetStartWithWindows(!StartsWithWindows()));
        menu.Items.Add(startup);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(new ToolStripMenuItem("Quit", null, (_, _) => wallpaper.Quit("tray")));
        menu.Opening += (_, _) => Sync();

        icon = new NotifyIcon
        {
            Icon = Program.AppIcon,
            Text = "Orrery wallpaper",
            ContextMenuStrip = menu,
        };
        icon.MouseDoubleClick += (_, e) =>
        {
            if (e.Button == MouseButtons.Left)
                Launch("");
        };
        Sync();
        icon.Visible = true;
    }

    public void Sync()
    {
        pause.Text = wallpaper.Paused ? "Resume" : "Pause";
        startup.Checked = StartsWithWindows();
        icon.Text = wallpaper.Paused ? "Orrery wallpaper (paused)" : "Orrery wallpaper";
    }

    static void Launch(string args)
    {
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(Environment.ProcessPath!, args) { UseShellExecute = false });
        }
        catch (Exception e)
        {
            Log.Write($"tray: could not start Orrery {args}: {e.Message}");
        }
    }

    static string RunCommand => $"\"{Environment.ProcessPath}\" --wallpaper";

    public static bool StartsWithWindows()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RunKey);
            return key?.GetValue(RunValue) is string value && value.Length > 0;
        }
        catch
        {
            return false;
        }
    }

    public static void SetStartWithWindows(bool on)
    {
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(RunKey);
            if (on)
                key.SetValue(RunValue, RunCommand);
            else
                key.DeleteValue(RunValue, false);
            Log.Write($"tray: start with Windows {(on ? "on" : "off")}");
        }
        catch (Exception e)
        {
            Log.Write($"tray: could not change start with Windows: {e.Message}");
        }
    }

    public void Dispose()
    {
        icon.Visible = false;
        icon.ContextMenuStrip?.Dispose();
        icon.Dispose();
    }
}
