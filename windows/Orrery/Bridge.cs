// SPDX-License-Identifier: GPL-2.0-or-later
// What the page calls as window.OrreryHost (web/js/host.js): the same
// methods the Android app's Bridge.kt has. WebView2 shows this object to
// the page through chrome.webview.hostObjects.sync, so the page's calls
// return at once, as they do on Android. The names are the page's.

using System.Runtime.InteropServices;
using System.Text.Json;

namespace Orrery;

// What a window that holds a page does for it.
public interface IPageOwner
{
    // An action from the page: true if done, false if this surface cannot.
    bool Call(string action, string arg);
    // An answer to the page's question, or null.
    string? Ask(string action, string arg) => null;
    void PageReady() { }
}

[ClassInterface(ClassInterfaceType.AutoDual)]
[ComVisible(true)]
#pragma warning disable IDE1006 // the page's names
public class Bridge
{
    readonly string surfaceName;
    readonly IPageOwner owner;

    public Bridge(string surface, IPageOwner owner)
    {
        surfaceName = surface;
        this.owner = owner;
    }

    public string settings() => SettingsStore.Shared.AllJson();

    public void save(string key, string json) => SettingsStore.Shared.Save(key, json);

    public string surface() => surfaceName;

    public string call(string action, string arg)
    {
        try
        {
            var answer = owner.Ask(action, arg);
            if (answer != null)
                return answer;
            return Common(action, arg) || owner.Call(action, arg) ? "ok" : "no";
        }
        catch (Exception e)
        {
            Log.Write($"bridge: {action}: {e}");
            return "no";
        }
    }

    // What every surface does the same way.
    static bool Common(string action, string arg)
    {
        switch (action)
        {
        case "open":
            if (!Uri.TryCreate(arg, UriKind.Absolute, out var uri) || (uri.Scheme != "https" && uri.Scheme != "http"))
                return false;
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true });
            return true;
        case "refreshRate":
            return true;    // Windows picks the screen's rate itself
        }
        return false;
    }

    public string status() => JsonSerializer.Serialize(Status.Now());

    public void ready() => owner.PageReady();
}
#pragma warning restore IDE1006

// What the settings page shows as "In use" and the version.
public static class Status
{
    public static Dictionary<string, object> Now() => new()
    {
        ["version"] = typeof(Status).Assembly.GetName().Version?.ToString(3) ?? "",
        ["platform"] = "windows",
        ["wallpaper"] = Integration.WallpaperRunning(),
        ["dream"] = Integration.ScreensaverIsOrrery(),
    };
}
