// SPDX-License-Identifier: GPL-2.0-or-later
// The desktop app: the whole orrery in a window, with its controls and its
// settings page, as the Android app is. Also the screensaver's settings
// (Orrery.scr /c), which opens straight on the screensaver's page.

using System.Runtime.InteropServices;

namespace Orrery;

public sealed class AppWindow : Form, IPageOwner
{
    readonly string query;
    readonly bool closeOnExit;
    Page? page;
    bool fullscreen;
    FormWindowState wasState;
    Rectangle wasBounds;

    // settings: a settings page to open on ("dream" for the screensaver's).
    public AppWindow(string? settings = null, IntPtr owner = default)
    {
        query = settings == null ? "" : "settings=" + Uri.EscapeDataString(settings);
        closeOnExit = settings != null;
        Text = settings == "dream" ? "Orrery screensaver settings" : "Orrery";
        BackColor = Color.Black;
        Icon = Program.AppIcon;
        StartPosition = FormStartPosition.CenterScreen;
        var area = Screen.FromPoint(Cursor.Position).WorkingArea;
        Size = settings == null
            ? new Size(Math.Min(1440, area.Width * 4 / 5), Math.Min(900, area.Height * 4 / 5))
            : new Size(Math.Min(560, area.Width), Math.Min(820, area.Height * 9 / 10));
        KeyPreview = true;
        if (owner != IntPtr.Zero)
            StartPosition = FormStartPosition.CenterParent;
    }

    protected override async void OnLoad(EventArgs e)
    {
        base.OnLoad(e);
        try
        {
            page = await Page.Create(this, "app", this, query);
        }
        catch (Exception ex)
        {
            Program.WebView2Missing(ex);
            Close();
        }
    }

    protected override void OnKeyDown(KeyEventArgs e)
    {
        if (e.KeyCode == Keys.F11)
        {
            SetFullscreen(!fullscreen);
            e.Handled = true;
        }
        base.OnKeyDown(e);
    }

    public bool Call(string action, string arg)
    {
        switch (action)
        {
        case "exit":
            // Escape with nothing open: leave full screen, or close the
            // screensaver's settings; the app's window stays.
            if (fullscreen)
                SetFullscreen(false);
            else if (closeOnExit)
                Close();
            return true;
        case "immersive":
            SetFullscreen(arg == "true");
            return true;
        case "keepScreenOn":
            KeepAwake(arg == "true");
            return true;
        // The settings page's "Set up" rows on Windows (web/js/settings.js).
        case "wallpaper":
            return Integration.StartWallpaper();
        case "stopWallpaper":
            return Integration.StopWallpaper();
        case "screensaver":
            return Integration.OpenScreensaverSettings();
        case "setScreensaver":
            return Integration.SetScreensaver();
        }
        return false;
    }

    public void PageReady() => page?.MarkReady();

    void SetFullscreen(bool on)
    {
        if (on == fullscreen)
            return;
        fullscreen = on;
        if (on)
        {
            wasState = WindowState;
            wasBounds = Bounds;
            WindowState = FormWindowState.Normal;
            FormBorderStyle = FormBorderStyle.None;
            Bounds = Screen.FromControl(this).Bounds;
        }
        else
        {
            FormBorderStyle = FormBorderStyle.Sizable;
            Bounds = wasBounds;
            WindowState = wasState;
        }
    }

    [DllImport("kernel32.dll")]
    static extern uint SetThreadExecutionState(uint flags);
    const uint ES_CONTINUOUS = 0x80000000, ES_DISPLAY_REQUIRED = 0x2, ES_SYSTEM_REQUIRED = 0x1;

    static void KeepAwake(bool on) =>
        SetThreadExecutionState(on ? ES_CONTINUOUS | ES_DISPLAY_REQUIRED | ES_SYSTEM_REQUIRED : ES_CONTINUOUS);

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        KeepAwake(false);
        page?.Dispose();
        base.OnFormClosed(e);
    }
}
