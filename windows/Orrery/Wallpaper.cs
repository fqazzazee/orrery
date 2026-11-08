// SPDX-License-Identifier: GPL-2.0-or-later
// The live wallpaper: one page per monitor behind the desktop icons
// (Desktop.cs), paused while nothing of it can be seen, with a tray icon
// (Tray.cs). One process at a time, held by MutexName; it quits when
// Integration.QuitEventName is set.
//
// For testing: ORRERY_EXIT_AFTER=<seconds> quits by itself, and
// ORRERY_IGNORE_COVER=1 keeps the pages running under other windows.

using System.Globalization;
using Microsoft.Win32;
using static Orrery.Native;

namespace Orrery;

public static class Wallpaper
{
    public const string MutexName = @"Local\Orrery.Wallpaper";

    public static int Run()
    {
        using var mutex = new Mutex(true, MutexName, out var first);
        if (!first)
        {
            Log.Write("wallpaper: already running");
            return 0;
        }
        try
        {
            SynchronizationContext.SetSynchronizationContext(new WindowsFormsSynchronizationContext());
            using var quit = new EventWaitHandle(false, EventResetMode.AutoReset, Integration.QuitEventName);
            using var wallpaper = new LiveWallpaper(quit);
            wallpaper.Start();
            Application.Run();
        }
        finally
        {
            mutex.ReleaseMutex();
        }
        Log.Write("wallpaper: stopped");
        return 0;
    }
}

sealed class LiveWallpaper : IDisposable
{
    // A monitor: its window behind the icons and its page.
    sealed class Screen : IPageOwner
    {
        public required string Name;
        public required Rectangle Bounds;
        public required Rectangle WorkingArea;
        public required WallpaperHost Host;
        public Page? Page;
        public bool Covered;
        public bool? Shown;     // what the page was last told

        public bool Call(string action, string arg) => false;
        public void PageReady() => Ready?.Invoke(this);
        public Action<Screen>? Ready;
    }

    readonly EventWaitHandle quitEvent;
    readonly RegisteredWaitHandle quitWait;
    readonly SynchronizationContext ui;
    readonly MessageWindow messages;
    readonly Tray tray;
    readonly List<Screen> screens = [];
    readonly System.Windows.Forms.Timer coverTimer = new() { Interval = 2000 };
    readonly System.Windows.Forms.Timer coverDebounce = new() { Interval = 250 };
    readonly System.Windows.Forms.Timer rebuildTimer = new();
    readonly System.Windows.Forms.Timer? exitTimer;
    readonly Native.WinEventProc winEventProc;
    readonly List<IntPtr> winEventHooks = [];
    readonly Native.HookProc mouseProc;
    readonly bool ignoreCover = Environment.GetEnvironmentVariable("ORRERY_IGNORE_COVER") == "1";
    readonly uint ownPid = (uint)Environment.ProcessId;
    IntPtr mouseHook;
    Point mouseDown;
    DesktopTarget? target;
    int attachTries;
    bool userPaused, locked, displayOff, quitting, disposed;

    public LiveWallpaper(EventWaitHandle quit)
    {
        ui = SynchronizationContext.Current!;
        quitEvent = quit;
        quitWait = ThreadPool.RegisterWaitForSingleObject(quit, (_, _) => ui.Post(_ => Quit("quit event"), null), null, Timeout.Infinite, true);
        messages = new MessageWindow(this);
        tray = new Tray(this);
        winEventProc = OnWinEvent;
        mouseProc = OnMouse;

        coverTimer.Tick += (_, _) => UpdateCover();
        coverDebounce.Tick += (_, _) => { coverDebounce.Stop(); UpdateCover(); };
        rebuildTimer.Tick += (_, _) => { rebuildTimer.Stop(); Rebuild(); };

        if (double.TryParse(Environment.GetEnvironmentVariable("ORRERY_EXIT_AFTER"), NumberStyles.Float, CultureInfo.InvariantCulture, out var seconds) && seconds > 0)
        {
            exitTimer = new System.Windows.Forms.Timer { Interval = (int)Math.Max(1, seconds * 1000) };
            exitTimer.Tick += (_, _) => Quit("ORRERY_EXIT_AFTER");
            exitTimer.Start();
        }
    }

    public bool Paused => userPaused;

    public void Start()
    {
        Log.Write($"wallpaper: starting{(ignoreCover ? " (ignoring covering windows)" : "")}");
        SystemEvents.DisplaySettingsChanged += OnDisplayChanged;
        SystemEvents.SessionSwitch += OnSessionSwitch;
        SystemEvents.UserPreferenceChanged += OnPreferenceChanged;
        SettingsStore.Shared.Changed += OnSetting;

        foreach (var (min, max) in new[] {
            (EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND),
            (EVENT_SYSTEM_MINIMIZESTART, EVENT_SYSTEM_MINIMIZEEND),
            (EVENT_OBJECT_LOCATIONCHANGE, EVENT_OBJECT_LOCATIONCHANGE),
            (EVENT_OBJECT_CLOAKED, EVENT_OBJECT_UNCLOAKED) })
        {
            var hook = SetWinEventHook(min, max, IntPtr.Zero, winEventProc, 0, 0, WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS);
            if (hook != IntPtr.Zero)
                winEventHooks.Add(hook);
        }
        coverTimer.Start();
        SyncMouseHook();
        Rebuild();
    }

    // ---- Windows behind the icons ----

    void Rebuild()
    {
        if (quitting)
            return;
        DestroyScreens();
        target = Desktop.Find();
        if (target == null)
        {
            // Explorer is starting or gone: try again for a while.
            attachTries++;
            Log.Write($"wallpaper: no desktop to attach to (try {attachTries})");
            if (attachTries < 60)
                ScheduleRebuild(1000);
            return;
        }
        attachTries = 0;
        Log.Write($"wallpaper: attaching, {target}");

        foreach (var monitor in System.Windows.Forms.Screen.AllScreens)
        {
            var host = new WallpaperHost(target, monitor.Bounds);
            var screen = new Screen
            {
                Name = monitor.DeviceName,
                Bounds = monitor.Bounds,
                WorkingArea = monitor.WorkingArea,
                Host = host,
            };
            screen.Ready = OnPageReady;
            host.HandleDestroyed += (_, _) => OnHostDestroyed(screen);
            try
            {
                host.Attach();
            }
            catch (Exception e)
            {
                Log.Write($"wallpaper: could not attach on {screen.Name}: {e.Message}");
                host.Dispose();
                continue;
            }
            screens.Add(screen);
            Log.Write($"wallpaper: {screen.Name} {screen.Bounds} at {Describe(host.Handle)} parent 0x{GetParent(host.Handle).ToInt64():X} scale {host.CssScale:0.##}");
            _ = CreatePage(screen);
        }
        Log.Write("wallpaper: desktop windows:" + Environment.NewLine + Desktop.Dump());
        UpdateCover();
    }

    async Task CreatePage(Screen screen)
    {
        try
        {
            screen.Page = await Page.Create(screen.Host, "wallpaper", screen);
        }
        catch (Exception e)
        {
            Log.Write($"wallpaper: no page on {screen.Name}: {e}");
            if (e is Microsoft.Web.WebView2.Core.WebView2RuntimeNotFoundException)
            {
                Program.WebView2Missing(e);
                Quit("no WebView2");
            }
        }
    }

    void OnPageReady(Screen screen)
    {
        if (screen.Page == null)
            return;
        screen.Page.MarkReady();
        SendInsets(screen);
        screen.Shown = null;
        Apply(screen);
        Log.Write($"wallpaper: page ready on {screen.Name}");
    }

    void SendInsets(Screen screen)
    {
        if (screen.Page?.IsReady != true)
            return;
        var b = screen.Bounds;
        var w = screen.WorkingArea;
        var s = screen.Host.CssScale;
        string Css(int px) => (px / s).ToString("0.##", CultureInfo.InvariantCulture);
        screen.Page.Send("insets", $"{{\"top\":{Css(w.Top - b.Top)},\"right\":{Css(b.Right - w.Right)},\"bottom\":{Css(b.Bottom - w.Bottom)},\"left\":{Css(w.Left - b.Left)}}}");
    }

    // Explorer took our windows with it (it restarted): build them again.
    void OnHostDestroyed(Screen screen)
    {
        if (quitting || !screens.Contains(screen))
            return;
        Log.Write($"wallpaper: window on {screen.Name} was destroyed");
        ScheduleRebuild(2000);
    }

    void ScheduleRebuild(int ms)
    {
        if (quitting)
            return;
        rebuildTimer.Stop();
        rebuildTimer.Interval = ms;
        rebuildTimer.Start();
    }

    void DestroyScreens()
    {
        var old = screens.ToList();
        screens.Clear();
        foreach (var s in old)
        {
            s.Page?.Dispose();
            s.Host.Dispose();
        }
    }

    public void ExplorerRestarted()
    {
        Log.Write("wallpaper: the taskbar was created (Explorer restarted)");
        ScheduleRebuild(1500);
    }

    void OnDisplayChanged(object? sender, EventArgs e)
    {
        Log.Write("wallpaper: display settings changed");
        ScheduleRebuild(1000);
    }

    void OnPreferenceChanged(object? sender, UserPreferenceChangedEventArgs e)
    {
        if (e.Category != UserPreferenceCategory.Desktop)
            return;
        // The taskbar may have moved or changed size.
        foreach (var screen in screens)
        {
            var monitor = System.Windows.Forms.Screen.AllScreens.FirstOrDefault(m => m.DeviceName == screen.Name);
            if (monitor != null && monitor.WorkingArea != screen.WorkingArea)
            {
                screen.WorkingArea = monitor.WorkingArea;
                SendInsets(screen);
            }
        }
    }

    // ---- Pausing ----

    void OnSessionSwitch(object? sender, SessionSwitchEventArgs e)
    {
        switch (e.Reason)
        {
        case SessionSwitchReason.SessionLock:
        case SessionSwitchReason.RemoteDisconnect:
        case SessionSwitchReason.ConsoleDisconnect:
            locked = true;
            break;
        case SessionSwitchReason.SessionUnlock:
        case SessionSwitchReason.RemoteConnect:
        case SessionSwitchReason.ConsoleConnect:
            locked = false;
            break;
        default:
            return;
        }
        Log.Write($"wallpaper: session {e.Reason}");
        ApplyAll();
    }

    public void DisplayState(int state)
    {
        // 0 off, 1 on, 2 dimmed
        var off = state == 0;
        if (off == displayOff)
            return;
        displayOff = off;
        Log.Write($"wallpaper: display {(off ? "off" : "on")}");
        ApplyAll();
    }

    public void SetUserPaused(bool paused)
    {
        userPaused = paused;
        Log.Write($"wallpaper: {(paused ? "paused" : "resumed")} from the tray");
        ApplyAll();
    }

    void OnWinEvent(IntPtr hook, uint ev, IntPtr hwnd, int idObject, int idChild, uint thread, uint time)
    {
        // Only windows themselves (OBJID_WINDOW), not the caret or the cursor.
        if (idObject != 0 || idChild != 0 || hwnd == IntPtr.Zero)
            return;
        if (ev == EVENT_OBJECT_LOCATIONCHANGE && hwnd != GetForegroundWindow())
            return;
        coverDebounce.Stop();
        coverDebounce.Start();
    }

    static readonly HashSet<string> ShellClasses =
    [
        "Progman", "WorkerW", "Shell_TrayWnd", "Shell_SecondaryTrayWnd", "NotifyIconOverflowWindow",
        "Windows.UI.Core.CoreWindow", "XamlExplorerHostIslandWindow", "TopLevelWindowForOverflowXamlIsland",
        "ForegroundStaging", "MultitaskingViewFrame", "TaskListThumbnailWnd", "Shell_InputSwitchTopLevelWindow",
    ];

    // Which monitors a window covers: maximized there, or spanning all of
    // it. Every app window counts, not just the foreground one, so clicking
    // the desktop beside a maximized window does not wake its monitor.
    void UpdateCover()
    {
        if (screens.Count == 0)
            return;
        var covered = new string?[screens.Count];
        if (!ignoreCover)
        {
            foreach (var h in TopLevelWindows())
            {
                if (!IsWindowVisible(h) || IsIconic(h) || IsCloaked(h) || ProcessOf(h) == ownPid)
                    continue;
                var ex = GetWindowLong(h, GWL_EXSTYLE);
                if ((ex & WS_EX_TRANSPARENT) != 0 || ((ex & WS_EX_TOOLWINDOW) != 0 && (ex & WS_EX_APPWINDOW) == 0))
                    continue;
                if ((ex & WS_EX_LAYERED) != 0 && GetLayeredWindowAttributes(h, out _, out var alpha, out var flags) && (flags & LWA_ALPHA) != 0 && alpha == 0)
                    continue;
                var cls = ClassOf(h);
                if (ShellClasses.Contains(cls))
                    continue;
                var rect = RectOf(h);
                var zoomed = IsZoomed(h);
                var monitor = zoomed ? MonitorFromWindow(h, MONITOR_DEFAULTTONEAREST) : IntPtr.Zero;
                for (int i = 0; i < screens.Count; i++)
                {
                    if (covered[i] != null)
                        continue;
                    var b = screens[i].Bounds;
                    var on = zoomed && monitor == MonitorFromPoint(new POINT { X = b.Left + b.Width / 2, Y = b.Top + b.Height / 2 }, MONITOR_DEFAULTTONEAREST);
                    if (on || rect.Contains(b))
                        covered[i] = $"{cls} 0x{h.ToInt64():X} {(on ? "maximized" : "full screen")}";
                }
            }
        }
        for (int i = 0; i < screens.Count; i++)
        {
            var now = covered[i] != null;
            if (now != screens[i].Covered)
            {
                screens[i].Covered = now;
                Log.Write($"wallpaper: {screens[i].Name} {(now ? "covered by " + covered[i] : "uncovered")}");
                Apply(screens[i]);
            }
        }
    }

    void ApplyAll()
    {
        foreach (var screen in screens)
            Apply(screen);
        tray.Sync();
    }

    void Apply(Screen screen)
    {
        if (screen.Page?.IsReady != true)
            return;
        var show = !userPaused && !locked && !displayOff && !screen.Covered;
        if (screen.Shown == show)
            return;
        screen.Shown = show;
        screen.Page.SetVisible(show);
        var why = string.Join(", ", new[] {
            userPaused ? "tray" : null, locked ? "session locked" : null,
            displayOff ? "display off" : null, screen.Covered ? "covered" : null }.Where(x => x != null));
        Log.Write($"wallpaper: {screen.Name} {(show ? "resumed" : "paused (" + why + ")")}");
    }

    // ---- Taps on the desktop ----

    static bool TapCards() => SettingsStore.Shared.Get("wallpaper/tap-cards")?.GetValue<bool>() ?? true;

    void OnSetting(string key, string value)
    {
        if (key == "wallpaper/tap-cards")
            SyncMouseHook();
    }

    void SyncMouseHook()
    {
        bool want;
        try
        {
            want = TapCards() && !quitting;
        }
        catch
        {
            want = true;
        }
        if (want && mouseHook == IntPtr.Zero)
        {
            mouseHook = SetWindowsHookEx(WH_MOUSE_LL, mouseProc, GetModuleHandle(null), 0);
            Log.Write($"wallpaper: desktop taps {(mouseHook != IntPtr.Zero ? "on" : "unavailable")}");
        }
        else if (!want && mouseHook != IntPtr.Zero)
        {
            UnhookWindowsHookEx(mouseHook);
            mouseHook = IntPtr.Zero;
            Log.Write("wallpaper: desktop taps off");
        }
    }

    // Kept short: every mouse event in the session waits for it.
    IntPtr OnMouse(int code, IntPtr wParam, IntPtr lParam)
    {
        if (code >= 0)
        {
            var msg = (int)wParam;
            if (msg == WM_LBUTTONDOWN || msg == WM_LBUTTONUP)
            {
                var info = System.Runtime.InteropServices.Marshal.PtrToStructure<MSLLHOOKSTRUCT>(lParam);
                var pt = new Point(info.pt.X, info.pt.Y);
                if (msg == WM_LBUTTONDOWN)
                    mouseDown = pt;
                else if (Math.Abs(pt.X - mouseDown.X) <= 4 && Math.Abs(pt.Y - mouseDown.Y) <= 4)
                    ui.Post(_ => DesktopClick(pt), null);
            }
        }
        return CallNextHookEx(mouseHook, code, wParam, lParam);
    }

    void DesktopClick(Point pt)
    {
        var under = WindowFromPoint(new POINT { X = pt.X, Y = pt.Y });
        var cls = ClassOf(under);
        var listView = cls == "SysListView32" && ClassOf(GetParent(under)) == "SHELLDLL_DefView";
        var desktop = listView || cls == "SHELLDLL_DefView" || cls == "Progman" || cls == "WorkerW";
        if (!desktop)
            return;
        var screen = screens.FirstOrDefault(s => s.Bounds.Contains(pt));
        if (screen?.Page?.IsReady != true || screen.Shown != true)
            return;
        // Wait for Explorer to handle the click, then: not on an icon if none is selected.
        var timer = new System.Windows.Forms.Timer { Interval = 60 };
        timer.Tick += (_, _) =>
        {
            timer.Stop();
            timer.Dispose();
            if (listView && SendMessage(under, LVM_GETSELECTEDCOUNT, IntPtr.Zero, IntPtr.Zero) != IntPtr.Zero)
                return;
            var s = screen.Host.CssScale;
            var x = ((pt.X - screen.Bounds.Left) / s).ToString("0.#", CultureInfo.InvariantCulture);
            var y = ((pt.Y - screen.Bounds.Top) / s).ToString("0.#", CultureInfo.InvariantCulture);
            screen.Page?.Send("tap", $"{{\"x\":{x},\"y\":{y}}}");
        };
        timer.Start();
    }

    // ---- Quitting ----

    public void Quit(string why)
    {
        if (quitting)
            return;
        quitting = true;
        Log.Write($"wallpaper: quitting ({why})");
        Shutdown();
        Application.ExitThread();
    }

    // Also for WM_ENDSESSION, when there may be no time for the message loop.
    public void Shutdown()
    {
        quitting = true;
        rebuildTimer.Stop();
        coverTimer.Stop();
        coverDebounce.Stop();
        exitTimer?.Stop();
        if (mouseHook != IntPtr.Zero)
        {
            UnhookWindowsHookEx(mouseHook);
            mouseHook = IntPtr.Zero;
        }
        foreach (var hook in winEventHooks)
            UnhookWinEvent(hook);
        winEventHooks.Clear();
        var had = screens.Count > 0;
        DestroyScreens();
        tray.Dispose();
        if (had)
            RepaintStaticWallpaper();
    }

    public void Dispose()
    {
        if (disposed)
            return;
        disposed = true;
        if (!quitting)
            Shutdown();
        quitWait.Unregister(null);
        SystemEvents.DisplaySettingsChanged -= OnDisplayChanged;
        SystemEvents.SessionSwitch -= OnSessionSwitch;
        SystemEvents.UserPreferenceChanged -= OnPreferenceChanged;
        SettingsStore.Shared.Changed -= OnSetting;
        messages.Dispose();
        coverTimer.Dispose();
        coverDebounce.Dispose();
        rebuildTimer.Dispose();
        exitTimer?.Dispose();
        GC.KeepAlive(quitEvent);
    }

    // A hidden top-level window: message-only windows miss the broadcasts
    // (TaskbarCreated, WM_ENDSESSION).
    sealed class MessageWindow : NativeWindow, IDisposable
    {
        static readonly uint TaskbarCreated = RegisterWindowMessage("TaskbarCreated");
        readonly LiveWallpaper owner;
        readonly IntPtr powerNotify;

        public MessageWindow(LiveWallpaper owner)
        {
            this.owner = owner;
            CreateHandle(new CreateParams { Caption = "Orrery wallpaper", ExStyle = WS_EX_TOOLWINDOW });
            var guid = GUID_CONSOLE_DISPLAY_STATE;
            powerNotify = RegisterPowerSettingNotification(Handle, ref guid, 0 /* DEVICE_NOTIFY_WINDOW_HANDLE */);
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == (int)TaskbarCreated && TaskbarCreated != 0)
                owner.ExplorerRestarted();
            else if (m.Msg == WM_POWERBROADCAST && (int)m.WParam == PBT_POWERSETTINGCHANGE && m.LParam != IntPtr.Zero)
            {
                var setting = System.Runtime.InteropServices.Marshal.PtrToStructure<Guid>(m.LParam);
                if (setting == GUID_CONSOLE_DISPLAY_STATE)
                    owner.DisplayState(System.Runtime.InteropServices.Marshal.ReadInt32(m.LParam, 20));
                m.Result = 1;
                return;
            }
            else if (m.Msg == WM_QUERYENDSESSION)
            {
                m.Result = 1;
                return;
            }
            else if (m.Msg == WM_ENDSESSION && m.WParam != IntPtr.Zero)
            {
                owner.Quit("session ending");
                m.Result = IntPtr.Zero;
                return;
            }
            base.WndProc(ref m);
        }

        public void Dispose()
        {
            if (powerNotify != IntPtr.Zero)
                UnregisterPowerSettingNotification(powerNotify);
            DestroyHandle();
        }
    }
}
