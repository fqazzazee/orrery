// SPDX-License-Identifier: GPL-2.0-or-later
// One Orrery page in a WebView2: the app, the wallpaper or the screensaver.
// The page and the lib/ modules are served from the app folder as
// https://orrery.app/, since ES modules do not load from file://. Every
// page shares one WebView2 profile under %LOCALAPPDATA%\Orrery: never next
// to the exe, which may be in Program Files or System32.

using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Orrery;

public sealed class Page : IDisposable
{
    public static readonly string DataFolder = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Orrery");
    const string Host = "orrery.app";

    static Task<CoreWebView2Environment>? environment;

    // Every process passes the same options, or WebView2 refuses to share
    // the profile between them.
    public static Task<CoreWebView2Environment> SharedEnvironment() =>
        environment ??= CoreWebView2Environment.CreateAsync(null, Path.Combine(DataFolder, "WebView2"),
            new CoreWebView2EnvironmentOptions("--autoplay-policy=no-user-gesture-required"));

    // Where app/web and app/lib are: next to the exe.
    public static string AppFolder => Path.Combine(AppContext.BaseDirectory, "app");

    public WebView2 View { get; }
    public string Surface { get; }
    public bool IsReady { get; private set; }
    public event Action? Ready;

    readonly IPageOwner owner;
    readonly Action<string, string> onSetting;
    readonly Action onPower;
    bool disposed;

    Page(WebView2 view, string surface, IPageOwner owner)
    {
        View = view;
        Surface = surface;
        this.owner = owner;
        onSetting = (key, value) => Send("setting", $"{{\"key\":{JsonSerializer.Serialize(key)},\"value\":{value}}}");
        onPower = () => Send("power", Power.Json());
    }

    // A page filling `parent`. query: extra URL parameters, as "settings=dream".
    public static async Task<Page> Create(Control parent, string surface, IPageOwner owner, string query = "")
    {
        var view = new WebView2
        {
            Dock = DockStyle.Fill,
            DefaultBackgroundColor = Color.Black,
        };
        parent.Controls.Add(view);
        var page = new Page(view, surface, owner);
        // The window may close while WebView2 starts (the screensaver's
        // preview often does): then there is nothing left to set up.
        try
        {
            await view.EnsureCoreWebView2Async(await SharedEnvironment());
        }
        catch (Exception) when (page.disposed || view.IsDisposed)
        {
            return page;
        }
        if (page.disposed || view.IsDisposed)
            return page;
        var core = view.CoreWebView2;

        var s = core.Settings;
        s.AreDefaultContextMenusEnabled = false;
        s.IsStatusBarEnabled = false;
        s.IsZoomControlEnabled = false;
        s.IsPinchZoomEnabled = false;
        s.IsSwipeNavigationEnabled = false;
        s.AreBrowserAcceleratorKeysEnabled = false;
        s.IsGeneralAutofillEnabled = false;
        s.IsPasswordAutosaveEnabled = false;
#if !DEBUG
        s.AreDevToolsEnabled = false;
#endif

        core.SetVirtualHostNameToFolderMapping(Host, AppFolder, CoreWebView2HostResourceAccessKind.DenyCors);
        core.AddHostObjectToScript("orrery", new Bridge(surface, page.owner));
        await core.AddScriptToExecuteOnDocumentCreatedAsync(
            "window.OrreryPlatform = 'windows';" +
            "window.OrreryHost = chrome.webview.hostObjects.sync.orrery;");

        // Only the page's own files: links open in the browser.
        core.NavigationStarting += (_, e) =>
        {
            if (!e.Uri.StartsWith($"https://{Host}/", StringComparison.OrdinalIgnoreCase))
            {
                e.Cancel = true;
                OpenExternal(e.Uri);
            }
        };
        core.NewWindowRequested += (_, e) =>
        {
            e.Handled = true;
            OpenExternal(e.Uri);
        };
        core.ProcessFailed += (_, e) =>
        {
            Log.Write($"page {surface}: WebView2 {e.ProcessFailedKind} ({e.Reason}); reloading");
            if (e.ProcessFailedKind is CoreWebView2ProcessFailedKind.RenderProcessExited or CoreWebView2ProcessFailedKind.RenderProcessUnresponsive)
                core.Reload();
        };
        core.NavigationCompleted += (_, e) =>
        {
            if (!e.IsSuccess)
                Log.Write($"page {surface}: navigation failed: {e.WebErrorStatus}");
        };

        SettingsStore.Shared.Changed += page.onSetting;
        Power.Changed += page.onPower;

        var url = $"https://{Host}/web/index.html?surface={surface}" + (query.Length > 0 ? "&" + query : "");
        core.Navigate(url);
        return page;
    }

    static void OpenExternal(string uri)
    {
        if (Uri.TryCreate(uri, UriKind.Absolute, out var u) && (u.Scheme == "https" || u.Scheme == "http"))
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(u.AbsoluteUri) { UseShellExecute = true });
    }

    // Called by the owner from IPageOwner.PageReady (the page's Host.ready()).
    public void MarkReady()
    {
        IsReady = true;
        Send("power", Power.Json());
        Ready?.Invoke();
    }

    // window.orrery.fromHost(type, data): data is JSON text.
    public void Send(string type, string json)
    {
        if (disposed || View.CoreWebView2 == null)
            return;
        _ = View.CoreWebView2.ExecuteScriptAsync(
            $"window.orrery && window.orrery.fromHost({JsonSerializer.Serialize(type)}, {json})");
    }

    // Stops the page's frame clock (and lets WebView2 throttle it) while
    // nothing of it can be seen.
    public void SetVisible(bool visible)
    {
        Send("visible", visible ? "true" : "false");
        if (View.CoreWebView2 != null)
            View.Visible = visible;
    }

    public void Dispose()
    {
        if (disposed)
            return;
        disposed = true;
        SettingsStore.Shared.Changed -= onSetting;
        Power.Changed -= onPower;
        View.Dispose();
    }
}
