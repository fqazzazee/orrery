// SPDX-License-Identifier: GPL-2.0-or-later
// Orrery for Windows. One exe, started as:
//   Orrery.exe                the app
//   Orrery.exe --wallpaper    the live wallpaper, with a tray icon
//   Orrery.exe --settings wallpaper   the app on that settings page
//   Orrery.scr /s             the screensaver, on every screen
//   Orrery.scr /p <hwnd>      its preview in the Screen Saver Settings box
//   Orrery.scr /c[:hwnd]      its settings (also with no arguments, as .scr)

namespace Orrery;

public enum Mode { App, Wallpaper, Screensaver, Preview, Configure, Settings }

public static class Program
{
    public static Icon AppIcon { get; private set; } = SystemIcons.Application;

    [STAThread]
    static int Main(string[] args)
    {
        var (mode, hwnd) = ParseArgs(args, Path.GetExtension(Environment.ProcessPath ?? "").Equals(".scr", StringComparison.OrdinalIgnoreCase));
        ApplicationConfiguration.Initialize();
        try
        {
            AppIcon = Icon.ExtractAssociatedIcon(Environment.ProcessPath!) ?? SystemIcons.Application;
        }
        catch
        {
            // the default
        }
        Application.ThreadException += (_, e) => Log.Write($"error: {e.Exception}");
        AppDomain.CurrentDomain.UnhandledException += (_, e) => Log.Write($"fatal: {e.ExceptionObject}");
        Log.Write($"start {mode} {string.Join(' ', args)}");

        switch (mode)
        {
        case Mode.Screensaver:
            return ScreenSaver.Run();
        case Mode.Preview:
            return ScreenSaver.Preview(hwnd);
        case Mode.Configure:
            Application.Run(new AppWindow("dream", hwnd));
            return 0;
        case Mode.Wallpaper:
            return Wallpaper.Run();
        case Mode.Settings:
            Application.Run(new AppWindow(args.Length > 1 ? args[1] : "wallpaper"));
            return 0;
        default:
            Application.Run(new AppWindow());
            return 0;
        }
    }

    // Windows passes "/s", "/p 1234", "/p:1234", "/c:1234", in any case.
    public static (Mode, IntPtr) ParseArgs(string[] args, bool isScr)
    {
        if (args.Length == 0)
            return (isScr ? Mode.Configure : Mode.App, IntPtr.Zero);
        var first = args[0].Trim();
        if (first.Equals("--wallpaper", StringComparison.OrdinalIgnoreCase))
            return (Mode.Wallpaper, IntPtr.Zero);
        if (first.Equals("--settings", StringComparison.OrdinalIgnoreCase))
            return (Mode.Settings, IntPtr.Zero);
        if (first.Length < 2 || (first[0] != '/' && first[0] != '-'))
            return (Mode.App, IntPtr.Zero);
        var letter = char.ToLowerInvariant(first[1]);
        var rest = first.Length > 2 ? first[2..].TrimStart(':') : args.Length > 1 ? args[1] : "";
        var hwnd = long.TryParse(rest, out var h) ? new IntPtr(h) : IntPtr.Zero;
        return letter switch
        {
            's' => (Mode.Screensaver, IntPtr.Zero),
            'p' or 'l' => (Mode.Preview, hwnd),
            'c' => (Mode.Configure, hwnd),
            _ => (Mode.App, IntPtr.Zero),
        };
    }

    public static void WebView2Missing(Exception e)
    {
        Log.Write($"WebView2: {e}");
        if (e is Microsoft.Web.WebView2.Core.WebView2RuntimeNotFoundException)
        {
            var go = MessageBox.Show("Orrery needs the Microsoft Edge WebView2 Runtime, which comes with Windows 11. Open its download page?",
                "Orrery", MessageBoxButtons.YesNo, MessageBoxIcon.Information);
            if (go == DialogResult.Yes)
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("https://developer.microsoft.com/microsoft-edge/webview2/") { UseShellExecute = true });
        }
        else
            MessageBox.Show($"Orrery could not start its page: {e.Message}", "Orrery", MessageBoxButtons.OK, MessageBoxIcon.Error);
    }
}
